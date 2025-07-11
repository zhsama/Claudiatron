/**
 * Claude Logo Icon Component with animated lines
 */

import React from 'react'

interface ClaudeIconProps {
  className?: string
  size?: number
  animated?: boolean
}

export const ClaudeIcon: React.FC<ClaudeIconProps> = ({
  className = '',
  size = 20,
  animated = true
}) => {
  return (
    <div
      className={`inline-block ${className}`}
      style={{ position: 'relative', width: size, height: size }}
    >
      <svg
        overflow="visible"
        width="100%"
        height="100%"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
      >
        {/* 定义动画关键帧 */}
        <style>
          {animated &&
            `
            @keyframes claudeRotate {
              0% { 
                transform: rotate(0deg) scaleY(1.39862) rotate(0deg);
                opacity: 0.7;
              }
              20% { 
                transform: rotate(72deg) scaleY(1.39862) rotate(-72deg);
                opacity: 1;
              }
              40% { 
                transform: rotate(144deg) scaleY(1.39862) rotate(-144deg);
                opacity: 0.8;
              }
              60% { 
                transform: rotate(216deg) scaleY(1.39862) rotate(-216deg);
                opacity: 1;
              }
              80% { 
                transform: rotate(288deg) scaleY(1.39862) rotate(-288deg);
                opacity: 0.9;
              }
              100% { 
                transform: rotate(360deg) scaleY(1.39862) rotate(-360deg);
                opacity: 0.7;
              }
            }
            
            .claude-line {
              animation: claudeRotate 3s ease-in-out infinite;
              transform-origin: 50px 50px;
            }
            
            .claude-line:nth-child(2) { animation-delay: 0s; }
            .claude-line:nth-child(3) { animation-delay: 0.25s; }
            .claude-line:nth-child(4) { animation-delay: 0.5s; }
            .claude-line:nth-child(5) { animation-delay: 0.75s; }
            .claude-line:nth-child(6) { animation-delay: 1s; }
            .claude-line:nth-child(7) { animation-delay: 1.25s; }
            .claude-line:nth-child(8) { animation-delay: 1.5s; }
            .claude-line:nth-child(9) { animation-delay: 1.75s; }
            .claude-line:nth-child(10) { animation-delay: 2s; }
            .claude-line:nth-child(11) { animation-delay: 2.25s; }
            .claude-line:nth-child(12) { animation-delay: 2.5s; }
            .claude-line:nth-child(13) { animation-delay: 2.75s; }
          `}
        </style>

        <path
          className={animated ? 'claude-line' : ''}
          d="M80.3951 43.3924 L83.7354 44.5478 L83.6668 45.5791 L82.5611 47.9859 L56.0000 57.0000 L52.0040 47.0708 L80.3951 43.3924 M80.3951 43.3924"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(330deg) scaleY(1.39846) rotate(-330deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M70.3978 23.2961 L74.2244 23.4318 L75.0657 24.5985 L75.5184 27.6012 L74.6811 29.6669 L58.5000 58.5000 L49.0000 49.0000 L66.0236 27.5090 L70.3978 23.2961 M70.3978 23.2961"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(300deg) scaleY(1.39867) rotate(-300deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M53.5810 20.3767 L55.6833 18.2422 L57.3186 19.0628 L58.7098 22.2580 L56.6511 48.1620 L52.0005 45.0000 L50.0005 39.5000 L52.1562 24.4357 L53.5810 20.3767 M53.5810 20.3767"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(270deg) scaleY(1.3984) rotate(-270deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M31.5690 18.9001 L33.4385 15.6128 L34.9052 15.4035 L37.9108 16.3769 L39.4740 18.0575 L48.8202 34.6902 L54.0089 49.8008 L47.9378 53.1760 L33.4992 24.5857 L31.5690 18.9001 M31.5690 18.9001"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(240deg) scaleY(1.39889) rotate(-240deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M22.4536 34.7350 L20.9662 31.5551 L23.1280 29.2506 L26.2565 30.2137 L27.1135 30.3829 L36.1725 35.6786 L42.5000 40.5000 L51.5000 47.5000 L46.5000 56.0000 L42.0002 52.5000 L39.0001 49.5000 L24.1257 36.4160 L22.4536 34.7350 M22.4536 34.7350"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(210deg) scaleY(1.39835) rotate(-210deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M18.4111 51.9951 L16.1788 50.3398 L16.1703 48.8279 L18.4208 48.3379 L31.2214 49.1464 L53.0000 51.0000 L52.1885 55.9782 L20.3956 52.2773 L18.4111 51.9951 M18.4111 51.9951"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(180deg) scaleY(1.39893) rotate(-180deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M29.3887 68.4085 L25.1054 69.2696 L23.7112 67.8000 L24.1336 65.7212 L32.7850 59.9960 L53.5082 46.0337 L57.0005 52.0000 L29.3887 68.4085 M29.3887 68.4085"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(150deg) scaleY(1.39885) rotate(-150deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M34.4936 78.9906 L32.9167 79.7253 L30.8130 78.7808 L31.5779 76.4612 L52.0003 50.5000 L56.0004 55.9999 L40.6055 70.5508 L34.4936 78.9906 M34.4936 78.9906"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(120deg) scaleY(1.39913) rotate(-120deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M51.3383 82.1236 L50.3412 84.1106 L48.2781 85.1289 L46.6131 83.1919 L45.7233 80.2661 L51.0003 55.4999 L55.5001 55.9999 L51.3383 82.1236 M51.3383 82.1236"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(90deg) scaleY(1.39935) rotate(-90deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M67.9986 74.2155 L68.6276 77.7712 L68.4589 79.0548 L67.0632 79.6893 L64.3814 78.7846 L47.4669 57.2642 L56.9998 50.0002 L64.0117 63.5455 L60.5253 63.1976 L67.9986 74.2155 M67.9986 74.2155"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(60deg) scaleY(1.39916) rotate(-60deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M76.5204 71.0792 L77.3419 73.1876 L76.3508 74.6160 L74.9934 73.9652 L66.9268 67.5303 L61.8375 63.8090 L55.0007 60.4991 L58.0000 51.0000 L62.9999 54.0001 L66.0007 59.4991 L76.5204 71.0792 M76.5204 71.0792"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(30deg) scaleY(1.39844) rotate(-30deg)'
                }
              : {}
          }
        />
        <path
          className={animated ? 'claude-line' : ''}
          d="M66.7737 52.8386 L79.2139 54.2198 L82.2944 55.7188 L84.4556 57.9248 L84.6136 59.4555 L79.4908 60.6034 L66.5005 59.0000 L55.0003 58.5000 L58.0000 48.0000 L66.0005 54.0000 L66.7737 52.8386 M66.7737 52.8386"
          fill="#D97757"
          style={
            !animated
              ? {
                  transformOrigin: '50px 50px',
                  transform: 'rotate(0deg) scaleY(1.39862) rotate(0deg)'
                }
              : {}
          }
        />
      </svg>
    </div>
  )
}
