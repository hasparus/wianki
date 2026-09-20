import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as THREE from "three";
import type { Impl } from "./harness";
import {
	anchorScroll,
	computeLayout,
	easeOut,
	type Item,
	type Layout,
	lerpRect,
	nearestLevel,
	type Rect,
	scaleRect,
	unionRange,
	visibleRange,
	ZOOM_MS,
} from "./layout";

type Props = {
	items: Item[];
	levels: number[];
	initialCols: number;
	onImpl: (impl: Impl) => void;
	onLoad: () => void;
	onRenderer: (name: string) => void;
	/** Long edge of uploaded textures; 0 keeps the source size. */
	texSize: number;
};

type Anim = {
	from: Layout;
	to: Layout;
	t0: number;
	ds: number;
	live: { s: number; ox: number; oy: number } | null;
	done: () => void;
};

type View = { scrollTop: number; zoom: number; ox: number; oy: number };

const BUFFER = 0.5;
const MAX_TEXTURES = 400;

/** Textures keyed by URL, LRU-evicted so GPU memory stays bounded. */
class TextureCache {
	private map = new Map<string, { texture: THREE.Texture; ready: boolean }>();
	private loader = new THREE.TextureLoader();
	constructor(
		private onLoad: () => void,
		private texSize: number,
	) {}
	get(url: string) {
		const hit = this.map.get(url);
		if (hit) {
			this.map.delete(url);
			this.map.set(url, hit);
			return hit;
		}
		const entry = { texture: new THREE.Texture(), ready: false };
		const finish = (t: THREE.Texture) => {
			t.colorSpace = THREE.SRGBColorSpace;
			t.minFilter = THREE.LinearMipmapLinearFilter;
			t.magFilter = THREE.LinearFilter;
			t.generateMipmaps = true;
			t.needsUpdate = true;
			entry.texture = t;
			entry.ready = true;
			this.onLoad();
		};
		if (this.texSize > 0) {
			// Decode and downsize off the main thread, then upload a small texture.
			const size = this.texSize;
			fetch(url)
				.then((r) => r.blob())
				.then(async (blob) => {
					const probe = await createImageBitmap(blob);
					const scale = size / Math.max(probe.width, probe.height);
					const w = Math.max(1, Math.round(probe.width * scale));
					const h = Math.max(1, Math.round(probe.height * scale));
					probe.close();
					const bitmap = await createImageBitmap(blob, {
						imageOrientation: "flipY",
						resizeWidth: w,
						resizeHeight: h,
						resizeQuality: "high",
					});
					const t = new THREE.Texture(bitmap);
					t.flipY = false;
					finish(t);
				});
		} else this.loader.load(url, finish);
		this.map.set(url, entry);
		if (this.map.size > MAX_TEXTURES) {
			const [oldest, old] = this.map.entries().next().value!;
			old.texture.dispose();
			this.map.delete(oldest);
		}
		return entry;
	}
}

const plane = new THREE.PlaneGeometry(1, 1);
const placeholder = new THREE.MeshBasicMaterial({ color: "#d8d8d8" });

function applyCover(texture: THREE.Texture, rect: Rect, item: Item) {
	const ta = rect.w / rect.h;
	const ia = item.w / item.h;
	if (ia > ta) {
		texture.repeat.set(ta / ia, 1);
		texture.offset.set((1 - ta / ia) / 2, 0);
	} else {
		texture.repeat.set(1, ia / ta);
		texture.offset.set(0, (1 - ia / ta) / 2);
	}
}

function Tile({
	index,
	item,
	cache,
	animRef,
	layoutRef,
}: {
	index: number;
	item: Item;
	cache: TextureCache;
	animRef: React.MutableRefObject<Anim | null>;
	layoutRef: React.MutableRefObject<Layout>;
}) {
	const mesh = useRef<THREE.Mesh>(null);
	const [entry, setEntry] = useState(() => cache.get(item.src));
	const [ready, setReady] = useState(entry.ready);
	const material = useMemo(
		() => new THREE.MeshBasicMaterial({ toneMapped: false }),
		[],
	);
	useEffect(() => () => material.dispose(), [material]);
	useFrame((_, __, ___) => {
		const m = mesh.current;
		if (!m) return;
		const e = cache.get(item.src);
		if (e !== entry) setEntry(e);
		if (e.ready && !ready) setReady(true);
		const anim = animRef.current;
		let rect: Rect;
		if (anim) {
			const t = Math.min(1, (performance.now() - anim.t0) / ZOOM_MS);
			let from = anim.from.rects[index];
			if (anim.live)
				from = scaleRect(from, anim.live.s, anim.live.ox, anim.live.oy);
			from = { x: from.x, y: from.y + anim.ds, w: from.w, h: from.h };
			rect = lerpRect(from, anim.to.rects[index], easeOut(t));
		} else {
			rect = layoutRef.current.rects[index];
		}
		m.position.set(rect.x + rect.w / 2, -(rect.y + rect.h / 2), 0);
		m.scale.set(rect.w, rect.h, 1);
		if (e.ready) {
			if (material.map !== e.texture) {
				material.map = e.texture;
				material.needsUpdate = true;
			}
			applyCover(e.texture, rect, item);
		}
	});
	return (
		<mesh
			ref={mesh}
			geometry={plane}
			material={ready ? material : placeholder}
		/>
	);
}

function CameraRig({ viewRef }: { viewRef: React.MutableRefObject<View> }) {
	const { camera, size } = useThree();
	useLayoutEffect(() => {
		const cam = camera as THREE.OrthographicCamera;
		cam.left = -size.width / 2;
		cam.right = size.width / 2;
		cam.top = size.height / 2;
		cam.bottom = -size.height / 2;
		cam.near = 0.1;
		cam.far = 100;
		cam.updateProjectionMatrix();
	}, [camera, size]);
	useFrame(() => {
		const cam = camera as THREE.OrthographicCamera;
		const v = viewRef.current;
		const z = v.zoom;
		// Keep the content point under the focal viewport point fixed while zoomed.
		const cx = v.ox - (v.ox - size.width / 2) / z;
		const cy = v.oy - (v.oy - size.height / 2) / z;
		cam.position.set(cx, -cy, 10);
		if (cam.zoom !== z) {
			cam.zoom = z;
			cam.updateProjectionMatrix();
		}
	});
	return null;
}

function RendererProbe({ onRenderer }: { onRenderer: (name: string) => void }) {
	const gl = useThree((s) => s.gl);
	useEffect(() => {
		const ctx = gl.getContext();
		const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
		onRenderer(
			dbg
				? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
				: String(ctx.getParameter(ctx.RENDERER)),
		);
	}, [gl, onRenderer]);
	return null;
}

export function R3fGrid({
	items,
	levels,
	initialCols,
	onImpl,
	onLoad,
	onRenderer,
	texSize,
}: Props) {
	const width = window.innerWidth;
	const vh = window.innerHeight;
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<Layout>(() =>
		computeLayout(items, initialCols, width),
	);
	const [range, setRange] = useState<[number, number]>(() =>
		visibleRange(layout, 0, vh * (1 + BUFFER)),
	);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	const animRef = useRef<Anim | null>(null);
	const viewRef = useRef<View>({
		scrollTop: 0,
		zoom: 1,
		ox: width / 2,
		oy: vh / 2,
	});
	const pendingScroll = useRef<number | null>(null);
	const loaded = useRef(0);
	const cache = useMemo(
		() =>
			new TextureCache(() => {
				loaded.current++;
				onLoad();
			}, texSize),
		[onLoad, texSize],
	);

	const onScroll = useCallback(() => {
		const top = scrollerRef.current!.scrollTop;
		viewRef.current.scrollTop = top;
		viewRef.current.oy = top + vh / 2;
		if (animRef.current) return;
		const next = visibleRange(
			layoutRef.current,
			top - vh * BUFFER,
			top + vh * (1 + BUFFER),
		);
		setRange((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next));
	}, []);

	useLayoutEffect(() => {
		if (pendingScroll.current !== null && scrollerRef.current) {
			scrollerRef.current.scrollTop = pendingScroll.current;
			viewRef.current.scrollTop = pendingScroll.current;
			viewRef.current.oy = pendingScroll.current + vh / 2;
			pendingScroll.current = null;
		}
	});

	const zoomTo = useCallback(
		async (
			cols: number,
			focalY: number,
			live: { s: number; ox: number; oy: number } | null,
		) => {
			const from = layoutRef.current;
			const scroller = scrollerRef.current!;
			const scrollFrom = scroller.scrollTop;
			const to = computeLayout(items, cols, width);
			const scrollTo = anchorScroll(from, to, scrollFrom, focalY);
			const rangeFrom = visibleRange(
				from,
				scrollFrom - vh * BUFFER,
				scrollFrom + vh * (1 + BUFFER),
			);
			const rangeTo = visibleRange(
				to,
				scrollTo - vh * BUFFER,
				scrollTo + vh * (1 + BUFFER),
			);
			pendingScroll.current = scrollTo;
			viewRef.current.zoom = 1;
			await new Promise<void>((done) => {
				animRef.current = {
					from,
					to,
					t0: performance.now(),
					ds: scrollTo - scrollFrom,
					live,
					done,
				};
				setRange(unionRange(rangeFrom, rangeTo));
				setLayout(to);
				setTimeout(done, ZOOM_MS + 20);
			});
			animRef.current = null;
			setRange(rangeTo);
		},
		[items],
	);

	const impl = useMemo<Impl>(
		() => ({
			setCols: (cols, focalY) => zoomTo(cols, focalY, null),
			pinch: (scale, frames, focalY) =>
				new Promise<void>((resolve) => {
					const scroller = scrollerRef.current!;
					const oy = scroller.scrollTop + focalY;
					const ox = width / 2;
					viewRef.current.ox = ox;
					viewRef.current.oy = oy;
					let f = 0;
					const step = () => {
						f++;
						const s = 1 + (scale - 1) * Math.min(1, f / frames);
						viewRef.current.zoom = s;
						if (f < frames) requestAnimationFrame(step);
						else {
							const target = nearestLevel(levels, layoutRef.current.cols / s);
							zoomTo(target, focalY, { s, ox, oy }).then(resolve);
						}
					};
					requestAnimationFrame(step);
				}),
			scroller: () => scrollerRef.current!,
			loadedCount: () => loaded.current,
			cols: () => layoutRef.current.cols,
		}),
		[zoomTo, levels],
	);
	useEffect(() => onImpl(impl), [impl, onImpl]);

	const tiles = [];
	for (let i = range[0]; i < range[1]; i++) {
		tiles.push(
			<Tile
				key={items[i].id}
				index={i}
				item={items[i]}
				cache={cache}
				animRef={animRef}
				layoutRef={layoutRef}
			/>,
		);
	}

	return (
		<>
			<Canvas
				className="gl"
				orthographic
				flat
				dpr={window.devicePixelRatio}
				gl={{
					antialias: false,
					powerPreference: "high-performance",
					alpha: false,
				}}
				camera={{ position: [0, 0, 10] }}
				style={{ position: "fixed", inset: 0 }}
				onCreated={({ gl }) => gl.setClearColor("#efefef")}
			>
				<RendererProbe onRenderer={onRenderer} />
				<CameraRig viewRef={viewRef} />
				{tiles}
			</Canvas>
			<div className="r3f-scroller" ref={scrollerRef} onScroll={onScroll}>
				<div style={{ height: layout.height }} />
			</div>
		</>
	);
}
