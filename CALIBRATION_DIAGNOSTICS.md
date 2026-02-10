# Диагностика и исправления системы калибровки

## Дата: 2026-02-10

## Обнаруженные проблемы

### 1. ❌ Условия проверки ракурса камеры были слишком мягкие
**Проблема:** Порог `shoulder_vis_diff < 0.2` был слишком мягким, позволял калибровку с неправильного ракурса
**Решение:** Вернули оригинальный порог `< 0.15`

### 2. ❌ Уведомление о калибровке исчезало преждевременно  
**Проблема:** Баннер исчезал если поле `calibrated` существовало (даже если `false`)
**Решение:** Изменили логику на строгую проверку `calibrated === false`

### 3. ❌ Отсутствие логирования
**Проблема:** Невозможно было отследить, где именно происходят ошибки
**Решение:** Добавили подробное логирование на всех этапах

### 4. ❌ Недостаточная валидация данных
**Проблема:** Не проверялся размер файла, не проверялись ошибки сохранения в Supabase
**Решение:** Добавили все необходимые проверки

---

## Изменения в коде

### Backend: `calibration.py`

#### 1. Восстановлен корректный порог угла камеры
```python
# БЫЛО (строка 64):
if shoulder_vis_diff < 0.2 and left_shoulder.visibility > 0.7:

# СТАЛО:
if shoulder_vis_diff < 0.15 and left_shoulder.visibility > 0.7:
```

#### 2. Добавлено диагностическое логирование

**Проверка ракурса камеры:**
```python
print(f"📐 [CAMERA ANGLE CHECK]")
print(f"   L_Shoulder vis: {left_shoulder.visibility:.2f}, R_Shoulder vis: {right_shoulder.visibility:.2f}")
print(f"   Shoulder distance: {shoulder_distance:.3f}, Hip distance: {hip_distance:.3f}")
print(f"   ✅ ACCEPTED: Side view detected")
```

**Захват измерений:**
```python
print(f"📏 [CAPTURE MEASUREMENTS] Using {side_used} side")
print(f"   Femur: {femur_len:.3f}, Tibia: {tibia_len:.3f}, Torso: {torso_len:.3f}")
```

**Подсчет повторений:**
```python
print(f"🔄 [REP TRACKING] Stage: {self.stage}, Knee angle: {knee_angle:.1f}°")
print(f"   ⬇️ Transition to DOWN (angle {knee_angle:.1f}° < {self.DOWN_THRESHOLD}°)")
print(f"   ✅ REP COUNTED! Total: {self.rep_count}/{self.REQUIRED_REPS}")
```

**Расчет биомеханики:**
```python
print(f"🧮 [CALCULATING BIOMECHANICS]")
print(f"   Total measurements collected: {len(self.measurements)}")
print(f"   📐 Ratios: Femur/Tibia: {femur_to_tibia:.2f}")
print(f"   💪 Mobility Scores: Ankle: {ankle_mobility:.1f}/10")
```

### Backend: `main.py`

#### 1. Улучшено логирование калибровки
```python
print(f"\n{'='*60}")
print(f"📐 [CALIBRATION REQUEST] User ID: {user_id}")
print(f"   Filename: {file.filename}")
print(f"💾 [FILE SAVED] Path: {tmp_path}, Size: {file_size / 1024:.2f} KB")
```

#### 2. Добавлена проверка пустого файла
```python
if file_size == 0:
    print(f"❌ [ERROR] Video file is empty!")
    return {
        "status": "error",
        "message": "Видео файл пустой..."
    }
```

#### 3. Добавлен traceback для внутренних ошибок
```python
except Exception as e:
    import traceback
    print(f"   Traceback:")
    traceback.print_exc()
```

### Frontend: `HomeScreen.js`

#### 1. Исправлена логика отображения баннера
```javascript
// БЫЛО:
const calibrated = user.user_metadata?.calibrated || false;
if (!calibrated && reminderCount < 3) {

// СТАЛО:
const calibrated = metadata.calibrated;
if (calibrated === false && reminderCount < 3) {
```

**Важно:** Теперь баннер показывается только если `calibrated === false` (пользователь пропустил калибровку), а не просто когда поле отсутствует.

#### 2. Добавлено логирование
```javascript
console.log('[HomeScreen] Calibration check:', {
  calibrated,
  reminderCount,
  metadata
});

console.log('[HomeScreen] Hiding calibration banner', {
  reason: calibrated === true ? 'completed' : 'new user'
});
```

#### 3. Добавлена перепроверка при возврате на экран
```javascript
const unsubscribe = navigation.addListener('focus', () => {
  checkCalibrationStatus();
});
```

### Frontend: `CalibrationScreen.js`

#### 1. Детальное логирование всех этапов
```javascript
console.log('[CalibrationScreen] ========== STARTING CALIBRATION ==========');
console.log('[CalibrationScreen] User:', user.id);
console.log('[CalibrationScreen] Uploading to:', `${API_URL}/calibrate_user`);
console.log('[CalibrationScreen] Response status:', response.status);
console.log('[CalibrationScreen] Response data:', JSON.stringify(data, null, 2));
```

#### 2. Проверка ошибок Supabase
```javascript
const { error: updateError } = await supabase.auth.updateUser({
    data: updateData
});

if (updateError) {
    console.error('[CalibrationScreen] ❌ Supabase update error:', updateError);
    setError('Не удалось сохранить данные калибровки');
    setStep(STEPS.CHECK);
    return;
}

console.log('[CalibrationScreen] ✅ Saved to Supabase successfully');
```

---

## Как проверить, что всё работает

### 1. Запустить бэкенд с логированием
```bash
cd backend
python main.py
```

### 2. Запустить мобильное приложение
```bash
cd mobile-app
npm start
```

### 3. Проверить калибровку

#### Сценарий 1: Успешная калибровка
1. Авторизоваться в приложении
2. Перейти на экран калибровки
3. Записать видео с 5 приседаниями
4. **Ожидаемый результат:**
   - В логах бэкенда видны все этапы: проверка ракурса, захват измерений, расчет биомеханики
   - В логах фронтенда подтверждение сохранения в Supabase
   - Переход на экран успеха
   - Баннер о калибровке больше не появляется на HomeScreen

#### Сценарий 2: Неправильный ракурс камеры
1. Записать видео спереди (не сбоку)
2. **Ожидаемый результат:**
   - В логах: `❌ REJECTED: Both shoulders visible (front/back view)`
   - Ошибка: "Камера должна быть сбоку"

#### Сценарий 3: Пропуск калибровки
1. Нажать "Пропустить" на экране калибровки
2. **Ожидаемый результат:**
   - `calibrated` устанавливается в `false`
   - Баннер появляется на HomeScreen
   - При повторной попытке баннер не исчезает до успешного завершения

#### Сценарий 4: Недостаточно приседаний
1. Записать видео с 3 приседаниями вместо 5
2. **Ожидаемый результат:**
   - В логах: Счетчик показывает 3/5
   - Ошибка валидации: "Недостаточно приседаний: 3/5"

---

## Мониторинг в логах

### Что смотреть в логах бэкенда:

```
📐 [CAMERA ANGLE CHECK]        # Проверка ракурса
   ✅ ACCEPTED                  # Ракурс правильный

📏 [CAPTURE MEASUREMENTS]      # Захват данных
   Femur: 0.123, Tibia: 0.098 # Пропорции тела

🔄 [REP TRACKING]              # Подсчет повторений
   Stage: down, Angle: 87.3°
   ✅ REP COUNTED! Total: 1/5  # Повторение засчитано

🎉 [CALIBRATION COMPLETE]      # Все 5 повторений выполнены

🧮 [CALCULATING BIOMECHANICS]  # Расчет результатов
   💪 Mobility Scores: Ankle: 8.2/10
   🎯 Generated Thresholds     # Персональные пороги
```

### Что смотреть в логах фронтенда:

```
[CalibrationScreen] Starting video recording...
[CalibrationScreen] Recording complete: uri: file://...
[CalibrationScreen] ========== STARTING CALIBRATION ==========
[CalibrationScreen] User: 123e4567-e89b-12d3-a456-426614174000
[CalibrationScreen] Response status: 200
[CalibrationScreen] Response data: { "status": "success", ... }
[CalibrationScreen] ✅ Calibration successful!
[CalibrationScreen] ✅ Saved to Supabase successfully
[CalibrationScreen] ========== CALIBRATION END ==========

[HomeScreen] Calibration check: { calibrated: true, ... }
[HomeScreen] Hiding calibration banner { reason: 'completed' }
```

---

## Диагностика проблем

### Проблема: Камера не отдает значений

**Проверка 1:** В логах должны появляться сообщения `📏 [CAPTURE MEASUREMENTS]`
- Если не появляются → камера не детектирует позу
- Проверить расстояние от камеры (2-3 метра)
- Проверить освещение

**Проверка 2:** Проверить значения visibility
```
L_Shoulder vis: 0.95, R_Shoulder vis: 0.32
```
- Значения должны быть > 0.5 для используемой стороны
- Если низкие → плохая видимость, улучшить освещение

### Проблема: Сервер не принимает значения

**Проверка 1:** Размер файла
```
💾 [FILE SAVED] Size: 0.00 KB  ← ПРОБЛЕМА!
```
- Если 0 KB → видео не записалось
- Проверить права доступа к камере

**Проверка 2:** Статус ответа
```
[CalibrationScreen] Response status: 500  ← ОШИБКА СЕРВЕРА
```
- Смотреть traceback в логах бэкенда

**Проверка 3:** Формат данных
```
[CalibrationScreen] Response data: { "status": "error", "message": "..." }
```
- Читать message для деталей

### Проблема: Данные не сохраняются в Supabase

**Проверка:**
```
[CalibrationScreen] ❌ Supabase update error: {...}
```
- Проверить подключение к Supabase
- Проверить структуру метаданных

---

## Тестовые пороги

### Допустимые значения для успешной калибровки:

- **Угол камеры:**
  - `shoulder_vis_diff < 0.15` - один плечо должно быть малозаметно
  - `shoulder_distance < 0.15` - плечи перекрываются при виде сбоку
  - `hip_distance < 0.15` - бедра перекрываются

- **Повторения:**
  - Минимум: 5 приседаний
  - Угол вниз: < 100° (DOWN_THRESHOLD)
  - Угол вверх: > 160° (UP_THRESHOLD)
  - Глубина: угол < 95° для захвата измерений

- **Биомеханика:**
  - `femur_to_tibia_ratio`: обычно 0.95-1.15
  - `torso_to_leg_ratio`: обычно 0.4-0.5
  - `ankle_mobility_score`: 1-10
  - `hip_mobility_score`: 1-10

---

## Changelog

### 2026-02-10
- ✅ Восстановлен корректный порог угла камеры (0.15)
- ✅ Добавлено полное логирование всех этапов калибровки
- ✅ Исправлена логика отображения баннера калибровки
- ✅ Добавлена валидация размера файла
- ✅ Добавлена проверка ошибок сохранения в Supabase
- ✅ Добавлен traceback для внутренних ошибок
- ✅ Добавлена перепроверка статуса при возврате на HomeScreen
