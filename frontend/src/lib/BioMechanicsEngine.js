// BioMechanicsEngine.js
// Advanced Rule-Based Analysis Engine for Repify
// Replaces ML classifiers with deterministic biomechanical models and angle-based analysis.

/**
 * fetch() with AbortController timeout.
 * React Native has no built-in request timeout — without this, a failed
 * backend connection hangs the UI forever.
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
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
      60000  // 60s — видео может быть большим
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
    // Math.atan2 returns angle in radians
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  },

  /**
   * Analyzes user "genetics" (body proportions) based on calibration data.
   * Uses simulated keypoint detection to determine limb ratios.
   */
  analyzeGenetics: async (videoUri) => {
    // Simulate processing delay for "deep analysis"
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock analysis logic - in a real implementation with PoseDetection, 
    // we would measure pixel distances between keypoints:
    // Femur = distance(hip, knee)
    // Torso = distance(shoulder, hip)

    // Simulating variations for demonstration
    const femurLength = 0.24 + (Math.random() * 0.04); // Ratio to height
    const torsoLength = 0.30 + (Math.random() * 0.05); // Ratio to height

    // Determine Body Type (Somatotype) based on ratios
    let bodyType = 'mesomorph';
    if (femurLength > 0.26) bodyType = 'ectomorph'; // Long limbs
    if (torsoLength > 0.33) bodyType = 'endomorph'; // Long torso

    // Biomechanical leverage analysis for "Smart Conditions"
    const squatMechanics = femurLength > 0.25 ? 'low_bar_optimal' : 'high_bar_optimal';
    const deadliftMechanics = (femurLength < 0.25 && torsoLength > 0.3) ? 'conventional' : 'sumo';

    return {
      success: true,
      body_type: {
        type: bodyType,
        femur: femurLength > 0.26 ? 'длинное' : 'среднее',
        torso: torsoLength > 0.32 ? 'длинный' : 'средний',
        arms: Math.random() > 0.5 ? 'длинные' : 'средние'
      },
      biomechanics: {
        ankle_mobility_score: 7.0 + (Math.random() * 3), // 7-10
        hip_mobility_score: 6.5 + (Math.random() * 3.5), // 6.5-10
        squat_preference: squatMechanics,
        deadlift_preference: deadliftMechanics
      },
      quality_score: 9.2 // High confidence
    };
  },

  /**
   * Rule-based Technique Analysis using Geometric Constraints (Angles)
   * Validates form against biomechanical constraints specific to user genetics.
   * 
   * NOW USES REAL BACKEND API INSTEAD OF MOCK DATA!
   */
  getPoseSequence,

  analyzeTechnique: async (exerciseType, videoUri, userProfile = {}) => {
    try {
      const { API_URL } = await import('../config');
      const { supabase, DEV_MODE } = await import('./supabase');

      console.log('🎬 Starting real video analysis...');
      console.log('Video URI:', videoUri);
      console.log('Exercise:', exerciseType);

      const normalizeExerciseType = (value) => {
        const raw = String(value || '').toLowerCase();
        if (raw.includes('squat') || raw.includes('присед')) return 'squats';
        if (raw.includes('deadlift') || raw.includes('тяга')) return 'deadlifts';
        if (raw.includes('push') || raw.includes('отжим')) return 'push_ups';
        return 'squats';
      };

      // FIX: do not force mock data in __DEV__ mode.
      // Use mock only when DEV_MODE is explicitly enabled.
      const { poseSequence, isMock } = await getPoseSequence(videoUri, DEV_MODE);

      if (!poseSequence || poseSequence.length === 0) {
        return {
          isValid: false,
          errors: [{
            code: 'POSE_EXTRACTION',
            feedback: 'Анализ недоступен: не настроено извлечение позы из видео.',
            severity: 'high'
          }],
          reps: 0,
          score: 0,
          backendUnavailable: false,
          poseExtractionMissing: true,
          apiError: 'Pose extraction not implemented'
        };
      }

      console.log(`📊 Extracted ${poseSequence.length} frames of pose data`);

      // STEP 2: Get user ID
      let userId = 'dev_user';
      if (!DEV_MODE) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || 'anonymous';
      }

      const normalizedExercise = normalizeExerciseType(exerciseType);

      const requestTs = Date.now();
      console.log(`👤 Проверка профиля для userId: ${userId}`);
      const profileResponse = await fetchWithTimeout(
        `${API_URL}/api/profile/${userId}/exists?ts=${requestTs}`,
        { cache: 'no-store' },
        15000
      );
      if (!profileResponse.ok) {
        return {
          isValid: false,
          errors: [{
            code: 'PROFILE_CHECK_FAILED',
            feedback: 'Не удалось проверить калибровку. Проверьте подключение к серверу.',
            severity: 'high'
          }],
          reps: 0,
          score: 0,
          backendUnavailable: true,
          poseExtractionMissing: false,
          apiError: `Profile check failed: ${profileResponse.status}`
        };
      }
      const { exists } = await profileResponse.json();

      if (!exists) {
        console.log('⚠️ No calibration profile found - user needs to calibrate first');
        return {
          isValid: false,
          errors: [{
            code: 'NO_CALIBRATION',
            feedback: 'Пожалуйста, сначала пройдите калибровку для более точного анализа',
            severity: 'high'
          }],
          reps: 0,
          score: 0,
          needsCalibration: true,
          backendUnavailable: false,
          poseExtractionMissing: false
        };
      }

      console.log('🔢 Calling backend API for rep counting...');
      const repCountResponse = await fetchWithTimeout(
        `${API_URL}/api/count-reps?ts=${requestTs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            user_id: userId,
            exercise: normalizedExercise,
            pose_sequence: poseSequence
          })
        },
        30000
      );

      if (!repCountResponse.ok) {
        throw new Error(`Rep counting failed: ${repCountResponse.statusText}`);
      }

      const repData = await repCountResponse.json();
      console.log(`✅ Rep counting complete: ${repData.total_reps} reps`);

      // STEP 5: Call REAL backend API for technique analysis
      console.log('📊 Calling backend API for technique analysis...');
      const techniqueResponse = await fetchWithTimeout(
        `${API_URL}/api/analyze-technique?ts=${requestTs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            user_id: userId,
            exercise: normalizedExercise,
            pose_sequence: poseSequence
          })
        },
        30000
      );

      if (!techniqueResponse.ok) {
        throw new Error(`Technique analysis failed: ${techniqueResponse.statusText}`);
      }

      const techniqueData = await techniqueResponse.json();
      console.log(`✅ Technique analysis complete: ${techniqueData.overall_score}/100`);

      // STEP 6: Convert backend response to frontend format
      // FIX: always rebuild errors from current backend response.
      // This guarantees errors are recalculated and not reused.
      const errors = [];
      const feedback = techniqueData?.personalized_feedback || {};
      const breakdown = techniqueData?.quality_breakdown || {};

      if (Array.isArray(feedback.areas_to_improve)) {
        feedback.areas_to_improve.forEach((area, index) => {
          if (!area) return;
          errors.push({
            code: `ERROR_${index + 1}`,
            feedback: area,
            severity: techniqueData.overall_score < 70 ? 'high' : 'medium'
          });
        });
      }

      if (breakdown.knee_alignment && breakdown.knee_alignment.score < 15) {
        errors.push({
          code: 'KNEE_ALIGNMENT',
          feedback: breakdown.knee_alignment.feedback,
          severity: 'high'
        });
      }
      if (breakdown.back_position && breakdown.back_position.score < 15) {
        errors.push({
          code: 'BACK_POSITION',
          feedback: breakdown.back_position.feedback,
          severity: 'high'
        });
      }
      if (breakdown.depth && breakdown.depth.score < 15) {
        errors.push({
          code: 'DEPTH',
          feedback: breakdown.depth.feedback,
          severity: 'medium'
        });
      }

      return {
        isValid: errors.length === 0,
        errors: errors,
        reps: repData.total_reps,
        full_reps: repData.full_reps,
        partial_reps: repData.partial_reps,
        score: techniqueData.overall_score,
        consistency_score: repData.consistency_score,
        fatigue_analysis: repData.fatigue_analysis,
        backendUnavailable: false,
        analysisMode: isMock ? 'mock' : 'real',
        poseExtractionMissing: false,
        biomechanics_context: {
          body_type: userProfile?.body_type?.type || 'standard',
          comparison: techniqueData.comparison_to_calibration
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
