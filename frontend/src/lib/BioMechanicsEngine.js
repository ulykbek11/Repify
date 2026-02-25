// BioMechanicsEngine.js
// Unified AI-Powered Analysis Engine for Repify
// Uses single /api/analyze endpoint — Gemini AI handles calibration, rep counting, and technique analysis.

/**
 * fetch() with AbortController timeout.
 * React Native has no built-in request timeout — without this, a failed
 * backend connection hangs the UI forever.
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = 600000) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => {
    controller.abort();
    console.warn(`⏱️ Timeout (${timeoutMs}ms) exceeded for: ${url}`);
  }, timeoutMs);

  try {
    console.log(`🚀 Запрос: ${options.method || 'GET'} ${url}`);
    if (options.body) {
      const preview = typeof options.body === 'string'
        ? options.body.substring(0, 200)
        : '[FormData]';
      console.log(`📦 Body preview: ${preview}`);
    }

    const response = await fetch(url, { ...options, signal: controller.signal });
    console.log(`✅ Ответ: ${response.status} ← ${url}`);
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Сервер не ответил за ${timeoutMs / 1000}с. Проверь IP и что бэкенд запущен.`);
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
};

const getPoseSequence = async (videoUri, allowMock) => {
  try {
    const { API_URL } = await import('../config');
    console.log("🎬 Извлечение реальных поз из видео...");
    console.log(`📡 Бэкенд URL: ${API_URL}`);

    const formData = new FormData();
    formData.append('video', {
      uri: videoUri,
      name: 'video.mp4',
      type: 'video/mp4'
    });

    const response = await fetchWithTimeout(
      `${API_URL}/api/extract-poses`,
      {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      },
      600000  // 600s — видео может быть большим и обработка требует времени
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pose extraction failed: ${response.status} — ${errText}`);
    }

    const data = await response.json();
    console.log(`✅ Успешно извлекли ${data.pose_sequence.length} кадров через MediaPipe`);
    return { poseSequence: data.pose_sequence, isMock: false };
  } catch (err) {
    console.error("❌ Ошибка при реальной экстракции поз:", err.message);
    return { poseSequence: [], isMock: false };
  }
};

export const BioMechanicsEngine = {
  /**
   * Helper: Calculate angle between three points (A, B, C)
   * @param {Object} p1 - Point A {x, y}
   * @param {Object} p2 - Point B {x, y} (Vertex)
   * @param {Object} p3 - Point C {x, y}
   */
  calculateAngle: (p1, p2, p3) => {
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  },

  /**
   * [DEPRECATED] Old genetic analysis — now handled by Gemini inline.
   * Kept for backward compatibility if CalibrationScreen still calls it.
   */
  analyzeGenetics: async (videoUri) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      body_type: {
        type: 'average',
        femur: 'среднее',
        torso: 'средний',
        arms: 'средние'
      },
      biomechanics: {
        ankle_mobility_score: 8.0,
        hip_mobility_score: 8.0,
        squat_preference: 'high_bar_optimal',
        deadlift_preference: 'conventional'
      },
      quality_score: 9.0
    };
  },

  getPoseSequence,

  /**
   * Unified Technique Analysis via Gemini AI.
   *
   * Single call to /api/analyze — Gemini handles:
   *   1. Mini-calibration from first frames (standing pose)
   *   2. Rep counting from angle sequences
   *   3. Technique analysis with personalized proportions
   *
   * Returns: { reps, score, errors, strengths, coach_tip, calibration_notes }
   */
  analyzeTechnique: async (exerciseType, videoUri, userProfile = {}) => {
    try {
      const { API_URL } = await import('../config');
      const { supabase, DEV_MODE } = await import('./supabase');

      console.log('🎬 Starting unified Gemini AI analysis...');
      console.log('Video URI:', videoUri);
      console.log('Exercise:', exerciseType);

      const normalizeExerciseType = (value) => {
        const raw = String(value || '').toLowerCase();
        if (raw.includes('squat') || raw.includes('присед')) return 'squats';
        if (raw.includes('deadlift') || raw.includes('тяга')) return 'deadlifts';
        if (raw.includes('push') || raw.includes('отжим')) return 'push_ups';
        return 'squats';
      };

      // STEP 1: Extract poses from video via MediaPipe
      const { poseSequence, isMock } = await getPoseSequence(videoUri, DEV_MODE);

      if (!poseSequence || poseSequence.length === 0) {
        return {
          isValid: false,
          errors: [{
            code: 'POSE_EXTRACTION',
            feedback: 'Анализ недоступен: не удалось извлечь позу из видео.',
            severity: 'high'
          }],
          reps: 0,
          score: 0,
          backendUnavailable: false,
          poseExtractionMissing: true,
          apiError: 'Pose extraction failed'
        };
      }

      console.log(`📊 Extracted ${poseSequence.length} frames of pose data`);

      // STEP 2: Get user ID
      let userId = 'dev_user';
      if (!DEV_MODE) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || 'anonymous';
      }

      // STEP 3: Get user height from profile (if available)
      let userHeightCm = null;
      if (userProfile?.height) {
        userHeightCm = parseInt(userProfile.height, 10);
      }

      const normalizedExercise = normalizeExerciseType(exerciseType);
      const requestTs = Date.now();

      // STEP 4: Single unified call to /api/analyze
      console.log('🤖 Sending to unified /api/analyze...');
      console.log(`   Exercise: ${normalizedExercise}`);
      console.log(`   Frames: ${poseSequence.length}`);
      console.log(`   Height: ${userHeightCm || 'not provided'}`);

      const analyzeResponse = await fetchWithTimeout(
        `${API_URL}/api/analyze?ts=${requestTs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            user_id: userId,
            exercise: normalizedExercise,
            pose_sequence: poseSequence,
            user_height_cm: userHeightCm,
            camera_angle: 'side_profile'
          })
        },
        600000  // 600s — Gemini может думать дольше при большом количестве кадров
      );

      if (!analyzeResponse.ok) {
        const errText = await analyzeResponse.text();
        throw new Error(`Analysis failed: ${analyzeResponse.status} — ${errText}`);
      }

      const geminiResult = await analyzeResponse.json();
      console.log(`✅ Gemini analysis complete!`);
      console.log(`   Reps: ${geminiResult.total_reps}`);
      console.log(`   Score: ${geminiResult.score}/100`);
      console.log(`   Errors: ${geminiResult.errors?.length || 0}`);
      console.log(`   Coach tip: ${geminiResult.coach_tip}`);

      // STEP 5: Convert Gemini response to frontend format
      const errors = [];
      if (Array.isArray(geminiResult.errors)) {
        geminiResult.errors.forEach((errMsg, index) => {
          if (!errMsg) return;
          errors.push({
            code: `GEMINI_ERROR_${index + 1}`,
            feedback: errMsg,
            severity: geminiResult.score < 70 ? 'high' : 'medium'
          });
        });
      }

      return {
        isValid: errors.length === 0,
        errors: errors,
        reps: geminiResult.total_reps || 0,
        full_reps: geminiResult.total_reps || 0,
        partial_reps: 0,
        score: geminiResult.score || 0,
        strengths: geminiResult.strengths || [],
        coach_tip: geminiResult.coach_tip || '',
        calibration_notes: geminiResult.calibration_notes || '',
        consistency_score: 0.85,
        fatigue_analysis: { detected: false },
        backendUnavailable: false,
        analysisMode: isMock ? 'mock' : 'real',
        poseExtractionMissing: false,
        needsCalibration: false,  // No longer needed — Gemini does inline calibration
        biomechanics_context: {
          body_type: geminiResult.calibration_notes || 'standard',
          comparison: { has_profile: true }  // Gemini always calibrates
        }
      };

    } catch (error) {
      console.error('❌ Analysis error:', error);

      const errors = [];

      errors.push({
        code: 'API_FALLBACK',
        feedback: 'Анализ недоступен. Проверьте подключение к серверу.',
        severity: 'high'
      });

      return {
        isValid: errors.length === 0,
        errors: errors,
        reps: 0,
        score: 0,
        backendUnavailable: true,
        poseExtractionMissing: false,
        biomechanics_context: {
          body_type: userProfile?.body_type?.type || 'standard'
        },
        apiError: error.message
      };
    }
  }
};
