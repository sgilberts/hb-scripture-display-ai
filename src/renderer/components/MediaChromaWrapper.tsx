/**
 * MediaChromaWrapper.tsx
 * 
 * A wrapper component that captures a React element (img, video, or LiveCamera),
 * gets a ref to its underlying DOM element, and passes it to ChromaKeyCanvas.
 */

import React, { useCallback, useRef, useState } from 'react';
import ChromaKeyCanvas from './ChromaKeyCanvas';
import type { ChromaKeySettings } from '../core/chromaKeyEngine';

interface MediaChromaWrapperProps {
  /** The React element to render and key (e.g. <img/>, <video/>, <LiveCamera/>) */
  node: React.ReactElement;
  settings: ChromaKeySettings;
  showCheckerboard?: boolean;
}

export default function MediaChromaWrapper({ node, settings, showCheckerboard = false }: MediaChromaWrapperProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | HTMLCanvasElement>(null);
  const [sourceElement, setSourceElement] = useState<HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null>(null);
  const [hasProcessedFrame, setHasProcessedFrame] = useState(false);

  const setMediaElement = useCallback((el: unknown) => {
    let nextElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null = null;

    if (el instanceof HTMLVideoElement || el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
      nextElement = el;
    } else if (
      el &&
      typeof el === 'object' &&
      'videoRef' in el &&
      (el as { videoRef?: React.RefObject<HTMLVideoElement | null> }).videoRef?.current
    ) {
      nextElement = (el as { videoRef: React.RefObject<HTMLVideoElement> }).videoRef.current;
    }

    mediaRef.current = nextElement;
    setSourceElement(currentElement => (
      currentElement === nextElement ? currentElement : nextElement
    ));
    if (nextElement === null) {
      setHasProcessedFrame(false);
    }
  }, []);

  const originalRef = (node as any).ref;
  const handleRef = useCallback((el: any) => {
    setMediaElement(el);

    if (typeof originalRef === 'function') {
      originalRef(el);
    } else if (originalRef && 'current' in originalRef) {
      originalRef.current = el;
    }
  }, [originalRef, setMediaElement]);

  const handleCanPlay = useCallback((event: React.SyntheticEvent) => {
    setMediaElement(event.currentTarget);
    (node.props as any).onCanPlay?.(event);
  }, [node.props, setMediaElement]);

  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent) => {
    setMediaElement(event.currentTarget);
    (node.props as any).onLoadedMetadata?.(event);
  }, [node.props, setMediaElement]);

  const handleLoad = useCallback((event: React.SyntheticEvent) => {
    setMediaElement(event.currentTarget);
    (node.props as any).onLoad?.(event);
  }, [node.props, setMediaElement]);

  // We clone the element to inject our ref
  const clonedNode = React.cloneElement(node as React.ReactElement<{ ref?: React.Ref<any> }>, {
    ref: handleRef,
    onCanPlay: handleCanPlay,
    onLoadedMetadata: handleLoadedMetadata,
    onLoad: handleLoad,
    // Hide the original element visually, but keep it full-size in DOM so
    // cameras and videos continue decoding live frames for the canvas.
    style: {
      ...((node.props as any).style || {}),
      opacity: hasProcessedFrame ? 0 : 1,
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    }
  } as any);

  return (
    <div className="relative w-full h-full">
      {clonedNode}
      {sourceElement && (
        <ChromaKeyCanvas
          sourceRef={mediaRef}
          settings={settings}
          showCheckerboard={showCheckerboard}
          className="w-full h-full absolute inset-0"
          onFrameProcessed={() => setHasProcessedFrame(true)}
        />
      )}
    </div>
  );
}
