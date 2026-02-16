import { AbsoluteFill, IFrame, staticFile } from "remotion";

const models = [
  { file: "game-glm5.html", label: "GLM-5" },
  { file: "game-minimax25.html", label: "MiniMax M2.5" },
  { file: "game-gemini3pro.html", label: "Gemini 3 Pro" },
  { file: "game-opus46.html", label: "Claude Opus 4.6" },
];

const DIVIDER_WIDTH = 2;
const LABEL_HEIGHT = 36;

const ModelCell: React.FC<{
  file: string;
  label: string;
  row: number;
  col: number;
}> = ({ file, label, row, col }) => {
  const cellWidth = (1920 - DIVIDER_WIDTH) / 2;
  const cellHeight = (1080 - DIVIDER_WIDTH) / 2;
  const left = col * (cellWidth + DIVIDER_WIDTH);
  const top = row * (cellHeight + DIVIDER_WIDTH);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: cellWidth,
        height: cellHeight,
        overflow: "hidden",
      }}
    >
      <IFrame
        src={staticFile(file)}
        style={{
          width: cellWidth,
          height: cellHeight - LABEL_HEIGHT,
          border: "none",
        }}
        delayRenderTimeoutInMilliseconds={60000}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: LABEL_HEIGHT,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
        }}
      >
        <span
          style={{
            color: "#00ff88",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 18,
            fontWeight: "bold",
            letterSpacing: 1,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

export const GridComparison: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Grid dividers */}
      <div
        style={{
          position: "absolute",
          left: (1920 - DIVIDER_WIDTH) / 2,
          top: 0,
          width: DIVIDER_WIDTH,
          height: 1080,
          backgroundColor: "#333",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: (1080 - DIVIDER_WIDTH) / 2,
          width: 1920,
          height: DIVIDER_WIDTH,
          backgroundColor: "#333",
        }}
      />

      {/* 2x2 grid of model outputs */}
      {models.map((model, i) => (
        <ModelCell
          key={model.file}
          file={model.file}
          label={model.label}
          row={Math.floor(i / 2)}
          col={i % 2}
        />
      ))}
    </AbsoluteFill>
  );
};
