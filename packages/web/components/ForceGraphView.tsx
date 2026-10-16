"use client";

import { forwardRef, useCallback, type ComponentProps } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";

export type NodeLabelSprite = { id: number; text: string; visible: boolean };

type ForceGraphViewProps = Omit<ComponentProps<typeof ForceGraph3D>, "nodeThreeObject" | "ref"> & {
  nodeLabelSprite: (node: unknown) => NodeLabelSprite;
};

// three.js and the sprite labels live only in this lazily loaded module, so pages
// that render a graph do not ship WebGL code until the graph is about to be shown.
const ForceGraphView = forwardRef<ForceGraphMethods | undefined, ForceGraphViewProps>(
  function ForceGraphView({ nodeLabelSprite, ...props }, ref) {
    const nodeThreeObject = useCallback(
      (node: unknown) => {
        const label = nodeLabelSprite(node);
        const sprite = new SpriteText(label.text, 4, "rgba(244, 241, 232, 0.88)");
        const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
        sprite.fontFace = mono || "ui-monospace, monospace";
        sprite.position.set(0, 7, 0);
        sprite.userData.zipGraphLabel = true;
        sprite.userData.zipGraphLabelId = label.id;
        sprite.visible = label.visible;
        return sprite;
      },
      [nodeLabelSprite],
    );
    return <ForceGraph3D ref={ref as never} {...props} nodeThreeObject={nodeThreeObject} />;
  },
);

export default ForceGraphView;
