import React, { useContext, useMemo, useRef, useState } from "react";
import {
  View,
  Image,
  PanResponder,
  Platform,
  useWindowDimensions,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Sheet, Label, Button, Theme } from "../ui";
import { cropGeometry, CropTransform } from "../domain/crop";
import { cropBackground } from "../services/background";
import { useNotice } from "../feedback";
export interface CropImage {
  uri: string;
  width: number;
  height: number;
}
export function BackgroundCropper({
  image,
  onCancel,
  onConfirm,
}: {
  image: CropImage;
  onCancel: () => void;
  onConfirm: (data: string) => void;
}) {
  const t = useContext(Theme);
  const notice = useNotice();
  const window = useWindowDimensions();
  const frame = useMemo(() => {
    const height = Math.min(300, Math.max(160, window.height - 390));
    return {
      height,
      width: height * Math.min(1, Math.min(window.width, 480) / window.height),
    };
  }, [window.width, window.height]);
  const [stageWidth, setStageWidth] = useState(340);
  const [transform, setTransform] = useState<CropTransform>({
    zoom: 1,
    x: 0,
    y: 0,
  });
  const [busy, setBusy] = useState(false);
  const geometry = cropGeometry(image, frame, transform);
  const current = useRef(transform);
  current.current = transform;
  const start = useRef({ ...transform, distance: 0 });
  const distance = (touches: readonly { pageX: number; pageY: number }[]) =>
    touches?.length > 1
      ? Math.hypot(
          touches[0].pageX - touches[1].pageX,
          touches[0].pageY - touches[1].pageY,
        )
      : 0;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          start.current = {
            ...current.current,
            distance: distance(e.nativeEvent.touches),
          };
        },
        onPanResponderMove: (e, g) => {
          const d = distance(e.nativeEvent.touches);
          if (d > 0 && !start.current.distance)
            start.current = { ...current.current, distance: d };
          const zoom = Math.max(
            1,
            Math.min(
              6,
              start.current.zoom *
                (d && start.current.distance ? d / start.current.distance : 1),
            ),
          );
          const next = cropGeometry(image, frame, {
            zoom,
            x: start.current.x + g.dx,
            y: start.current.y + g.dy,
          });
          setTransform({ zoom, x: next.x, y: next.y });
        },
      }),
    [image.width, image.height, frame.width, frame.height],
  );
  const left = (stageWidth - frame.width) / 2;
  const top = 16;
  return (
    <Sheet
      visible
      title="框选背景"
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      <Label muted style={{ fontSize: 12 }}>
        拖动图片选范围，双指或滑条缩放。框内就是最终背景。
      </Label>
      <View
        accessibilityLabel="拖动图片调整背景取景"
        {...pan.panHandlers}
        onLayout={(e) => setStageWidth(e.nativeEvent.layout.width)}
        style={[
          {
            height: frame.height + 32,
            overflow: "hidden",
            borderRadius: 16,
            backgroundColor: "#252a3d",
          },
          Platform.OS === "web" ? ({ touchAction: "none" } as any) : undefined,
        ]}
      >
        <Image
          source={{ uri: image.uri }}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: geometry.width,
            height: geometry.height,
            left: (stageWidth - geometry.width) / 2 + geometry.x,
            top: (frame.height + 32 - geometry.height) / 2 + geometry.y,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: left,
            backgroundColor: "rgba(0,0,0,.58)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: left,
            backgroundColor: "rgba(0,0,0,.58)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left,
            width: frame.width,
            height: top,
            backgroundColor: "rgba(0,0,0,.58)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left,
            width: frame.width,
            height: top,
            backgroundColor: "rgba(0,0,0,.58)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top,
            left,
            width: frame.width,
            height: frame.height,
            borderWidth: 2,
            borderColor: "#fff",
            borderRadius: 2,
          }}
        >
          {[1, 2].map((n) => (
            <React.Fragment key={n}>
              <View
                style={{
                  position: "absolute",
                  left: `${(n * 100) / 3}%`,
                  height: "100%",
                  width: 1,
                  backgroundColor: "rgba(255,255,255,.3)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: `${(n * 100) / 3}%`,
                  width: "100%",
                  height: 1,
                  backgroundColor: "rgba(255,255,255,.3)",
                }}
              />
            </React.Fragment>
          ))}
        </View>
      </View>
      <View>
        <Label style={{ fontSize: 12 }}>
          缩放　{transform.zoom.toFixed(1)}×
        </Label>
        <Slider
          accessibilityLabel="背景取景缩放"
          minimumValue={1}
          maximumValue={6}
          step={0.01}
          value={transform.zoom}
          minimumTrackTintColor={t.accent}
          thumbTintColor={t.accent}
          onValueChange={(zoom) => {
            const next = cropGeometry(image, frame, { ...transform, zoom });
            setTransform({ zoom, x: next.x, y: next.y });
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            disabled={busy}
            secondary
            onPress={() => setTransform({ zoom: 1, x: 0, y: 0 })}
          >
            居中重置
          </Button>
        </View>
        <View style={{ flex: 1.5 }}>
          <Button
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                onConfirm(await cropBackground(image.uri, geometry.crop));
              } catch (e) {
                notice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在处理…" : "使用框选背景"}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
