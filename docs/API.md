# Repify API reference

A short reference for the backend HTTP API (`backend/app`). The interactive
OpenAPI page at `http://localhost:8000/docs` is generated from the same code and
is the source of truth for exact schemas; this page explains how the endpoints
fit together.

All analysis endpoints live under the `/api` prefix (`backend/app/api/analysis.py`).
Health endpoints are in `backend/app/main.py`.

## Typical flows

- **Web (upload or live camera):** poses are extracted in the browser, then the
  landmarks are sent to `POST /api/analyze`. No video leaves the device.
- **Native app:** the video is uploaded to `POST /api/extract-poses`, and the
  returned `pose_sequence` is sent to `POST /api/analyze`.
- **Live camera preview:** reads thresholds from `GET /api/exercises` so the
  on-device rep counter matches the server.

## `GET /` and `GET /health`

Liveness check. Returns `status`, `service`, `version`, the list of supported
exercise ids in `exercises`, and `engine`, which is `gemini` when a Gemini key is
configured and `local` otherwise.

## `GET /api/exercises`

Returns the exercise registry (`exercises.describe()`) as a JSON array. Each item
has `id`, `camera`, `camera_note`, `signal`, `signal_label`, `mode` (`reps` or
`hold`), the `rest` and `enter` thresholds, the `required` landmarks and the
`checks` that are evaluated.

## `POST /api/extract-poses`

Multipart upload with a single `video` field. The server runs MediaPipe Pose and
returns:

```json
{ "pose_sequence": [ { "landmarks": [ { "x": 0.5, "y": 0.4, "z": 0.0, "visibility": 0.9 } ], "timestamp": 33 } ] }
```

Each frame has 33 landmarks in MediaPipe order; missing landmarks are zeros.

Errors: `413` when the upload exceeds `max_upload_mb` (60 MB by default),
`400` when the video cannot be read, `422` when no person is detected.

## `POST /api/analyze`

JSON body:

| Field | Type | Notes |
| --- | --- | --- |
| `exercise` | string | Free-form name or id, e.g. `squats`, `Bench press`, `подтягивания`. Default `squats`. |
| `pose_sequence` | array | Frames with `landmarks` (33 items of `x`, `y`, optional `z`, `visibility`) and an optional `timestamp`. |
| `camera_angle` | string | Default `side_profile`. |
| `language` | string | Feedback language, `en` (default) or `ru`. |
| `user_height_cm` | int | Optional, 80 to 250. |
| `user_id` | string | Optional, not used by the analysis. |

Frames with fewer than 33 landmarks are dropped. The response contains
`exercise`, `signal`, `mode`, `total_reps`, `score`, `errors`, `strengths`,
`coach_tip`, `calibration_notes`, `rep_details` and `engine`; timed holds
(plank) also include `hold_seconds` and `intervals`. The API adds
`pose_preview` (joints and angles of the deepest frame, or `null`) and
`frames_analyzed`.

If Gemini is configured but the call fails, the request falls back to the local
analyzer instead of returning an error.

Errors: `422` for an unknown exercise (the message lists supported ids) or an
invalid body, `400` when fewer than 3 usable frames are sent.
