# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.1] - 2026-06-08

### Added
- **WubPad Controller:** Production-ready mobile/web MIDI controller.
- **Bi-directional Feedback:** Real-time transport, position, and scene status display.
- **Metering UI:** High-frequency per-stem peak level monitoring (20Hz telemetry).
- **MIDI Mapping:** Integrated 'Learn Mode' for binding hardware to macros/scenes.
- **Pairing UX:** Manual URL input with recent connection history and persistence.
- **Safety Mode:** Optional confirmation prompts for destructive playback actions.
- **Hardened Protocol:** Standardized `ENGINE_STATUS` and `EVENT_REJECTED` types.

### Fixed
- **Memory Leaks:** Correct cleanup of MIDI listeners and WebSocket telemetry intervals.
- **Connection Stability:** Exponential backoff and heartbeat monitoring.
- **Type Safety:** Comprehensive TypeScript coverage for all protocol intents.

### Performance
- Throttled 50ms telemetry loop for low-latency visual feedback without flooding the network.
- Optimized React rendering paths with `useCallback` and `useRef`.
