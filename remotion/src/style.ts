// 채널 스타일의 단일 출처: bible/03_style.json
import style from "../../bible/03_style.json";

export { style };

export const colors = style.palette;

// Pretendard·RIDIBatang이 설치되지 않은 PC에서도 깨지지 않도록 대체 폰트를 붙인다.
const fallback = `"${style.fonts.fallback}", "Malgun Gothic", sans-serif`;
export const fonts = {
  title: `"${style.fonts.title}", ${fallback}`,
  body: `"${style.fonts.body}", ${fallback}`,
  quote: `"${style.fonts.quote}", serif`,
};
