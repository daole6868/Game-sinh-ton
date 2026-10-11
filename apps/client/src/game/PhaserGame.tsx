import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { WorldScene } from './scene/WorldScene';

let current: Phaser.Game | null = null;

export function getScene(): WorldScene | null {
  const s = current?.scene.getScene('world');
  return (s as WorldScene | undefined) ?? null;
}

/** Khung chứa canvas Phaser (thế giới game). Giao diện React nằm đè lên trên. */
export function PhaserGame() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#0d0a10',
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      input: { mouse: { preventDefaultWheel: false } },
      render: { antialias: false, powerPreference: 'high-performance' },
      scene: [WorldScene],
    });
    current = game;
    return () => {
      game.destroy(true);
      if (current === game) current = null;
    };
  }, []);
  return <div ref={ref} className="game-canvas" />;
}
