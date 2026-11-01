import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'

function colorVector(value, fallback = [0.61, 0.51, 1]) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value || '')
  if (!match) return fallback
  let hex = match[1]
  if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join('')
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
}

export default function MicroSlats({ color = '#9b83ff', slatWidth = 10, slatHeight = 25, gap = 3, speed = 0.24, interactive = true, cursorStrength = 0.6, paused = false, className = '' }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let renderer
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, depth: false })
    } catch {
      return undefined
    }
    const gl = renderer.gl
    if (!renderer.isWebgl2) {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return undefined
    }
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
    root.appendChild(canvas)
    const geometry = new Triangle(gl)
    const uniforms = {
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
      uMouse: { value: [-10, -10] },
      uColor: { value: colorVector(color) },
      uSlat: { value: [slatWidth, slatHeight] },
      uGap: { value: gap },
      uStrength: { value: cursorStrength },
    }
    const program = new Program(gl, {
      vertex: `#version 300 es
        in vec2 position;
        out vec2 vUv;
        void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: `#version 300 es
        precision highp float;
        in vec2 vUv;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform vec2 uSlat;
        uniform float uGap;
        uniform float uTime;
        uniform float uStrength;
        uniform vec3 uColor;
        out vec4 fragColor;
        float roundedBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }
        void main() {
          vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
          vec2 pitch = uSlat + vec2(uGap);
          vec2 cell = floor(p / pitch);
          vec2 center = cell * pitch + pitch * 0.5;
          float row = center.y / max(uResolution.y, 1.0);
          vec2 world = center / max(uResolution.y, 1.0);
          float wave = sin(world.x * 16.0 - world.y * 8.0 + uTime) * 0.5
            + sin(world.x * 8.0 + world.y * 13.0 - uTime * 0.7) * 0.3;
          float cursor = exp(-distance(center, uMouse) / max(uSlat.y * 5.0, 1.0));
          float height = uSlat.y * (0.58 + wave * 0.19 + cursor * uStrength * 0.28);
          vec2 local = p - center;
          float mask = 1.0 - smoothstep(-0.8, 0.8, roundedBox(local, vec2(uSlat.x, height) * 0.5, uSlat.x * 0.48));
          float light = clamp(0.12 + (wave + 0.6) * 0.17 + cursor * 0.5, 0.08, 0.78) * (0.52 + row * 0.48);
          fragColor = vec4(uColor * light, mask * 0.88);
        }`,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new Mesh(gl, { geometry, program })
    let raf = 0
    let alive = true
    let last = performance.now()
    const resize = () => {
      const width = Math.max(1, root.clientWidth)
      const height = Math.max(1, root.clientHeight)
      renderer.dpr = 1
      renderer.setSize(width, height)
      uniforms.uResolution.value = [width, height]
      uniforms.uSlat.value = [slatWidth, slatHeight]
      uniforms.uGap.value = gap
      uniforms.uColor.value = colorVector(color)
      draw(performance.now())
    }
    const draw = (now) => {
      raf = 0
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!paused) uniforms.uTime.value += dt * speed
      renderer.render({ scene: mesh })
      if (!paused && speed > 0) raf = requestAnimationFrame(draw)
    }
    const onMove = (event) => {
      const rect = root.getBoundingClientRect()
      uniforms.uMouse.value = [event.clientX - rect.left, event.clientY - rect.top]
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw) }
    }
    const onLeave = () => { uniforms.uMouse.value = [-10, -10] }
    const observer = new ResizeObserver(resize)
    observer.observe(root)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)
    resize()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onLeave)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }, [color, slatWidth, slatHeight, gap, speed, cursorStrength, paused])

  return <div ref={rootRef} className={`micro-slats ${className}`} aria-hidden="true" />
}
