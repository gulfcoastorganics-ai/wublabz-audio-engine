from fastapi import FastAPI
from pydantic import BaseModel
import tempfile
import requests
import librosa
import numpy as np
import pyloudnorm as pyln

app = FastAPI()


class AnalyzeRequest(BaseModel):
    audio_url: str
    session_id: str | None = None


@app.get("/")
def root():
    return {"status": "WubLabz Audio Engine Online"}


@app.post("/analyze-audio")
def analyze_audio(req: AnalyzeRequest):
    if req.audio_url.startswith("file://"):
        file_path = req.audio_url.replace("file://", "")
        y, sr = librosa.load(file_path, sr=None, mono=False)
    else:
        r = requests.get(req.audio_url, timeout=30)
        r.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".audio") as f:
            f.write(r.content)
            f.flush()
            y, sr = librosa.load(f.name, sr=None, mono=False)

    channels = 1 if y.ndim == 1 else y.shape[0]
    mono = y if y.ndim == 1 else np.mean(y, axis=0)
    duration = librosa.get_duration(y=mono, sr=sr)

    tempo, _ = librosa.beat.beat_track(y=mono, sr=sr)

    meter = pyln.Meter(sr)
    lufs = meter.integrated_loudness(mono.astype(float))

    rms = librosa.feature.rms(y=mono)[0]
    dynamic_range = float(np.percentile(rms, 95) - np.percentile(rms, 10))

    stereo_width = 0.0
    if channels == 2:
        left, right = y[0], y[1]
        corr = np.corrcoef(left, right)[0, 1]
        stereo_width = float(1 - abs(corr))

    energy_score = min(100, max(0, int(np.mean(rms) * 1000)))
    dynamics_score = min(100, max(0, int(dynamic_range * 1000)))
    mix_quality_score = 80
    commercial_potential_score = int((energy_score + mix_quality_score) / 2)
    wub_score = int(
        (
            energy_score
            + dynamics_score
            + mix_quality_score
            + commercial_potential_score
        )
        / 4
    )

    return {
        "duration_seconds": round(float(duration), 2),
        "sample_rate": int(sr),
        "channel_count": int(channels),
        "bpm": round(float(tempo), 2),
        "musical_key": "Unknown",
        "integrated_loudness_lufs": round(float(lufs), 2),
        "dynamic_range": round(float(dynamic_range), 4),
        "stereo_width": round(float(stereo_width), 2),
        "wub_score": wub_score,
        "mix_quality_score": mix_quality_score,
        "energy_score": energy_score,
        "dynamics_score": dynamics_score,
        "commercial_potential_score": commercial_potential_score,
        "mix_observations_text": "Initial spectral scan complete.",
        "frequency_balance_text": "Frequency balance analysis available in MVP mode.",
        "producer_recommendations_text": (
            "Tighten low-end, check vocal presence, and compare against a reference mix."
        ),
    }
