import React, { useEffect, useRef, useImperativeHandle } from 'react';

interface LiveCameraProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  deviceId?: string;
}

export const LiveCamera = React.forwardRef<HTMLVideoElement, LiveCameraProps>(
  ({ deviceId, className, ...props }, ref) => {
    const internalRef = useRef<HTMLVideoElement>(null);

    // Forward the internal ref to the parent so they both have access
    useImperativeHandle(ref, () => internalRef.current as HTMLVideoElement, []);

    useEffect(() => {
      let stream: MediaStream | null = null;

      const startCamera = async () => {
        if (!deviceId) return;
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } }
          });
          
          if (internalRef.current) {
            internalRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Failed to start camera for deviceId", deviceId, err);
        }
      };

      void startCamera();

      return () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }, [deviceId]);

    return (
      <video 
        ref={internalRef} 
        className={className} 
        autoPlay 
        playsInline 
        muted 
        {...props} 
      />
    );
  }
);
