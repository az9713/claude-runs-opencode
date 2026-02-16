import { Composition } from "remotion";
import { GridComparison } from "./GridComparison";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GridComparison"
        component={GridComparison}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
