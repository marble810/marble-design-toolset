import type {
	DataTexture,
	Mesh,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Texture,
	WebGLRenderer,
	WebGLRenderTarget
} from 'three';
import { OUTPUT_SIZE, type ShallowWaterParameters } from './shared.js';

type ThreeModule = typeof import('three');

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const computeFragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D stateTexture;
	uniform vec2 texelSize;
	uniform float waveSpeed;
	uniform float damping;
	uniform float edgeAbsorb;
	uniform float gridSize;

	void main() {
		vec4 state = texture2D(stateTexture, vUv);
		float height = state.r;
		float previous = state.g;
		float north = texture2D(stateTexture, vUv + vec2(0.0, texelSize.y)).r;
		float south = texture2D(stateTexture, vUv - vec2(0.0, texelSize.y)).r;
		float east = texture2D(stateTexture, vUv + vec2(texelSize.x, 0.0)).r;
		float west = texture2D(stateTexture, vUv - vec2(texelSize.x, 0.0)).r;
		float laplacian = north + south + east + west - 4.0 * height;
		float nextHeight = 2.0 * height - previous + waveSpeed * laplacian;
		nextHeight *= damping;

		float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)) * gridSize;
		float edgeFactor = edgeAbsorb <= 0.0 ? 1.0 : smoothstep(0.0, edgeAbsorb, edgeDistance);
		nextHeight *= edgeFactor;
		nextHeight = clamp(nextHeight, -4.0, 4.0);

		gl_FragColor = vec4(nextHeight, height, state.b, state.a);
	}
`;

const displayFragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D stateTexture;
	uniform float contrast;

	void main() {
		float height = texture2D(stateTexture, vUv).r;
		float gray = clamp(0.5 + height * contrast, 0.0, 1.0);
		gl_FragColor = vec4(vec3(gray), 1.0);
	}
`;

export class ShallowWaterWaveRenderer {
	readonly canvas: HTMLCanvasElement;
	private readonly THREE: ThreeModule;
	private readonly renderer: WebGLRenderer;
	private readonly scene: Scene;
	private readonly camera: OrthographicCamera;
	private readonly quad: Mesh;
	private readonly geometry: PlaneGeometry;
	private readonly computeMaterial: ShaderMaterial;
	private readonly displayMaterial: ShaderMaterial;
	private readonly targets: [WebGLRenderTarget, WebGLRenderTarget];
	private readonly size: number;
	private dataTexture: DataTexture | null = null;
	private currentTexture: Texture | null = null;
	private nextTargetIndex = 0;

	constructor(THREE: ThreeModule, canvas: HTMLCanvasElement, size: number) {
		this.THREE = THREE;
		this.canvas = canvas;
		this.size = size;
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: false,
			alpha: false,
			preserveDrawingBuffer: true
		});
		const outputWidth = canvas.width > 0 ? canvas.width : OUTPUT_SIZE;
		const outputHeight = canvas.height > 0 ? canvas.height : OUTPUT_SIZE;
		this.renderer.setPixelRatio(1);
		this.renderer.setSize(outputWidth, outputHeight, false);
		this.renderer.setClearColor(0x000000, 1);

		this.scene = new THREE.Scene();
		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.geometry = new THREE.PlaneGeometry(2, 2);
		this.computeMaterial = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: computeFragmentShader,
			uniforms: {
				stateTexture: { value: null },
				texelSize: { value: new THREE.Vector2(1 / size, 1 / size) },
				waveSpeed: { value: 0.16 },
				damping: { value: 0.992 },
				edgeAbsorb: { value: 22 },
				gridSize: { value: size }
			},
			depthTest: false,
			depthWrite: false
		});
		this.displayMaterial = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: displayFragmentShader,
			uniforms: {
				stateTexture: { value: null },
				contrast: { value: 1.8 }
			},
			depthTest: false,
			depthWrite: false
		});
		this.quad = new THREE.Mesh(this.geometry, this.displayMaterial);
		this.scene.add(this.quad);
		this.targets = [this.createTarget(), this.createTarget()];
	}

	setInitialHeight(heightData: Float32Array) {
		const stateData = new Float32Array(this.size * this.size * 4);
		for (let index = 0; index < heightData.length; index += 1) {
			const stateIndex = index * 4;
			const height = heightData[index] ?? 0;
			stateData[stateIndex] = height;
			stateData[stateIndex + 1] = height;
			stateData[stateIndex + 2] = 0;
			stateData[stateIndex + 3] = 1;
		}

		this.dataTexture?.dispose();
		this.dataTexture = new this.THREE.DataTexture(
			stateData,
			this.size,
			this.size,
			this.THREE.RGBAFormat,
			this.THREE.FloatType
		);
		this.dataTexture.minFilter = this.THREE.NearestFilter;
		this.dataTexture.magFilter = this.THREE.NearestFilter;
		this.dataTexture.wrapS = this.THREE.ClampToEdgeWrapping;
		this.dataTexture.wrapT = this.THREE.ClampToEdgeWrapping;
		this.dataTexture.needsUpdate = true;
		this.currentTexture = this.dataTexture;
		this.nextTargetIndex = 0;
	}

	step(parameters: ShallowWaterParameters) {
		if (!this.currentTexture) return;

		this.computeMaterial.uniforms.stateTexture.value = this.currentTexture;
		this.computeMaterial.uniforms.waveSpeed.value = parameters.waveSpeed;
		this.computeMaterial.uniforms.damping.value = parameters.damping;
		this.computeMaterial.uniforms.edgeAbsorb.value = parameters.edgeAbsorb;
		this.quad.material = this.computeMaterial;

		const target = this.targets[this.nextTargetIndex];
		this.renderer.setRenderTarget(target);
		this.renderer.render(this.scene, this.camera);
		this.renderer.setRenderTarget(null);
		this.currentTexture = target.texture;
		this.nextTargetIndex = 1 - this.nextTargetIndex;
	}

	render(parameters: ShallowWaterParameters) {
		this.displayMaterial.uniforms.stateTexture.value = this.currentTexture;
		this.displayMaterial.uniforms.contrast.value = parameters.contrast;
		this.quad.material = this.displayMaterial;
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.scene, this.camera);
	}

	advanceFrames(frameCount: number, parameters: ShallowWaterParameters) {
		const steps = Math.max(0, Math.round(frameCount) * parameters.stepsPerFrame);
		for (let index = 0; index < steps; index += 1) {
			this.step(parameters);
		}
	}

	dispose() {
		this.dataTexture?.dispose();
		this.targets[0].dispose();
		this.targets[1].dispose();
		this.computeMaterial.dispose();
		this.displayMaterial.dispose();
		this.geometry.dispose();
		this.renderer.dispose();
	}

	private createTarget(): WebGLRenderTarget {
		return new this.THREE.WebGLRenderTarget(this.size, this.size, {
			wrapS: this.THREE.ClampToEdgeWrapping,
			wrapT: this.THREE.ClampToEdgeWrapping,
			minFilter: this.THREE.NearestFilter,
			magFilter: this.THREE.NearestFilter,
			format: this.THREE.RGBAFormat,
			type: this.THREE.FloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
	}
}