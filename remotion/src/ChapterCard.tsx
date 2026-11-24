import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts, style } from "./style";

type Props = {
  number: number;
  title: string;
  year?: string;
  subtitle?: string;
  keyword?: string;
};

const ease = Easing.bezier(0.22, 1, 0.36, 1);

// 아래에서 12px 올라오며 나타나기 (03_style.json motion.textIn)
const useFadeUp = (startFrame: number, durationFrames = 9) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return { opacity: t, transform: `translateY(${(1 - t) * 12}px)` };
};

const Subtitle: React.FC<{ text: string; keyword?: string }> = ({ text, keyword }) => {
  const s = style.subtitle;
  const parts = keyword ? text.split(keyword) : [text];
  return (
    <div
      style={{
        position: "absolute",
        bottom: s.bottomOffset,
        width: "100%",
        textAlign: "center",
        fontFamily: fonts.body,
        fontSize: s.size,
        color: colors.text,
        textShadow: s.shadow,
      }}
    >
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span style={{ color: colors.accent }}>{keyword}</span>}
        </span>
      ))}
    </div>
  );
};

export const ChapterCard: React.FC<Props> = ({ number, title, year, subtitle, keyword }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const margin = style.canvas.safeMargin.longform;
  const scale = style.typeScale;

  // 챕터 전환: 왼쪽으로 닦아내며 등장 (transitions.chapter = wipe-left-600ms)
  const wipe = interpolate(frame, [0, Math.round(fps * 0.6)], [100, 0], {
    extrapolateRight: "clamp",
    easing: ease,
  });
  const fadeOut = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });

  const numberAnim = useFadeUp(6);
  const titleAnim = useFadeUp(12);
  const yearAnim = useFadeUp(18);
  const subAnim = useFadeUp(30);
  const markerAnim = useFadeUp(0, 6);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, opacity: fadeOut }}>
      <AbsoluteFill style={{ clipPath: `inset(0 ${wipe}% 0 0)` }}>
        {/* 상상/사실 표시 */}
        <div
          style={{
            position: "absolute",
            top: margin,
            left: margin,
            fontFamily: fonts.body,
            fontSize: scale.caption,
            color: colors.accent,
            border: `2px solid ${colors.accent}`,
            borderRadius: 6,
            padding: "4px 14px",
            ...markerAnim,
          }}
        >
          {style.realityMarker.imagination.label}
        </div>

        {/* big-number-left 레이아웃 */}
        <div
          style={{
            position: "absolute",
            left: margin,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 56,
          }}
        >
          <div
            style={{
              fontFamily: fonts.title,
              fontWeight: 900,
              fontSize: scale.chapterNumber,
              lineHeight: 1,
              color: colors.accent,
              ...numberAnim,
            }}
          >
            {String(number).padStart(2, "0")}
          </div>
          <div style={{ borderLeft: `2px solid ${colors.line}`, paddingLeft: 48 }}>
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: scale.caption,
                color: colors.muted,
                letterSpacing: 4,
                ...titleAnim,
              }}
            >
              제{number}장
            </div>
            <div
              style={{
                fontFamily: fonts.title,
                fontWeight: 900,
                fontSize: scale.chapterTitle,
                color: colors.text,
                marginTop: 8,
                ...titleAnim,
              }}
            >
              {title}
            </div>
            {year && style.chapterCard.showYear && (
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: scale.caption,
                  color: colors.muted,
                  marginTop: 16,
                  ...yearAnim,
                }}
              >
                {year}
              </div>
            )}
          </div>
        </div>

        {subtitle && (
          <AbsoluteFill style={subAnim}>
            <Subtitle text={subtitle} keyword={style.subtitle.highlightKeyword ? keyword : undefined} />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
