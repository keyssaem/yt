import { Composition } from "remotion";
import { ChapterCard } from "./ChapterCard";
import { style } from "./style";

const { width, height, fps } = style.canvas.longform;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 04_scene_library.md의 chapter-card 시험용 */}
      <Composition
        id="ChapterCardTest"
        component={ChapterCard}
        durationInFrames={fps * 5}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{
          number: 1,
          title: "첫 시험 날",
          year: "2027년 11월",
          subtitle: "그날 아침, 시험장 입구에 금속 탐지기가 놓였다.",
          keyword: "금속 탐지기",
        }}
      />
    </>
  );
};
