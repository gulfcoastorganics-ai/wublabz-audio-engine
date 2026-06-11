import React from 'react';
import type { WubGuideAvatarState } from './wubGuideTypes.js';

export function WubGuideAvatar({
  state = 'idle',
  label = 'WubGuide AI assistant avatar',
}: {
  state?: WubGuideAvatarState;
  label?: string;
}) {
  const isThinking = state === 'thinking';
  const isCelebrating = state === 'celebrating';
  const isPointing = state === 'pointing';

  return (
    <div
      className={`wubguide-avatar wubguide-avatar-${state}`}
      role="img"
      aria-label={label}
      data-avatar-state={state}
    >
      <svg viewBox="0 0 96 96" width="54" height="54" aria-hidden="true">
        <defs>
          <linearGradient id="wubGuideNote" x1="18" y1="8" x2="78" y2="86">
            <stop offset="0" stopColor="#eeeeff" stopOpacity="0.92" />
            <stop offset="0.42" stopColor="#8b7ff8" />
            <stop offset="1" stopColor="#5b9cf8" />
          </linearGradient>
          <filter id="wubGuideGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.36 0 0 0 0 0.61 0 0 0 0 0.97 0 0 0 0.72 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="47" cy="82" rx="25" ry="6" fill="rgba(0,0,0,0.32)" />

        <g filter="url(#wubGuideGlow)">
          <path
            d="M56 15c0-3 2.3-5 5.2-4.4l16.5 3.5c2.2.5 3.8 2.4 3.8 4.7v11.7c0 2.8-2.3 5-5.1 5H66v31.8c0 9.5-8.7 17-19.4 17-9.2 0-16.5-5.4-16.5-12.1 0-7.1 8.2-12.8 18.2-12.8 2.6 0 5.1.4 7.2 1.2V15z"
            fill="url(#wubGuideNote)"
          />
          <path
            d="M65.8 20.7v6.7h9.4v-4.7l-9.4-2z"
            fill="rgba(4,6,14,0.34)"
          />
        </g>

        <g className="wubguide-avatar-eyes">
          <ellipse cx="45" cy="40" rx="5.5" ry="7" fill="#050716" />
          <ellipse cx="63" cy="40" rx="5.5" ry="7" fill="#050716" />
          <circle cx={isPointing ? 47 : 43} cy={isThinking ? 38 : 37} r="2" fill="#eeeeff" />
          <circle cx={isPointing ? 65 : 61} cy={isThinking ? 38 : 37} r="2" fill="#eeeeff" />
        </g>

        <path
          className="wubguide-avatar-mouth"
          d={isCelebrating ? 'M47 51c4 5 12 5 16 0' : 'M49 52c3 2 8 2 11 0'}
          fill="none"
          stroke="#050716"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {isThinking && (
          <g className="wubguide-avatar-dots" fill="#eeeeff">
            <circle cx="21" cy="26" r="2.2" />
            <circle cx="15" cy="20" r="1.8" opacity="0.75" />
            <circle cx="10" cy="14" r="1.4" opacity="0.5" />
          </g>
        )}

        {isPointing && (
          <path
            className="wubguide-avatar-pointer"
            d="M76 49l12-5-6 11"
            fill="none"
            stroke="#eeeeff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="wubguide-avatar-bubble" aria-hidden="true" />
    </div>
  );
}
