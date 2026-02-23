import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BOWLING_SPEED } from '../utils/constants';
import { clamp } from '../utils/poseUtils';

export function useCricketSimulation({ enabled, mountRef, swingRef }) {
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    ball: null,
    bowler: null,
    pitch: null,
    hitZone: null,
    rafId: null,
    resizeObserver: null,
  });

  const stateRef = useRef({
    speedKey: "medium",
    phase: "IDLE",
    phaseStartedTs: 0,
    runupMs: 1200,
    releaseTs: 0,
    deliveryReady: true,
    ballActive: false,
    zoneEntered: false,
    startPos: { x: 0.0, y: 1.6, z: -10.8 },
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    gravity: 9.8,
    timingWindowMs: BOWLING_SPEED.medium.windowMs,
    zoneEntryTs: 0,
    resultTs: 0,
    resultLabel: "idle",
    lastTs: 0,
    hit: false,
  });

  const [sceneReady, setSceneReady] = useState(false);
  const [speedKey, setSpeedKey] = useState("medium");
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [stateLabel, setStateLabel] = useState("IDLE");
  const [result, setResult] = useState({
    outcome: "idle",
    reactionMs: null,
    timing: null,
    show: false,
  });

  function setBowlerPhase(phase, nowTs) {
    const s = stateRef.current;
    s.phase = phase;
    s.phaseStartedTs = nowTs;
    setStateLabel(phase);
  }

  function resetForNextBall() {
    const s = stateRef.current;
    s.deliveryReady = true;
    s.ballActive = false;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = 0;
    s.resultLabel = "idle";
    s.hit = false;
    setResult({ outcome: "idle", reactionMs: null, timing: null, show: false });
    setBowlerPhase("IDLE", performance.now());
    if (threeRef.current.ball) {
      threeRef.current.ball.visible = false;
    }
    swingRef.current.lastSwingTs = 0;
    swingRef.current.lastTriggerTs = 0;
    swingRef.current.smoothVel = 0;
  }

  function registerOutcome(label, nowTs, timing = null) {
    const swingTs = swingRef.current.lastSwingTs || 0;
    const reactionMs = swingTs
      ? Math.max(0, Math.round(nowTs - swingTs))
      : null;
    setResult({ outcome: label, reactionMs, timing, show: true });
    stateRef.current.resultTs = nowTs;
    stateRef.current.resultLabel = label;
    setDeliveryCount((v) => v + 1);
    if (label === "PERFECT") setHitCount((v) => v + 1);
  }

  function disposeScene() {
    const t = threeRef.current;
    if (t.rafId) cancelAnimationFrame(t.rafId);
    t.rafId = null;
    if (t.resizeObserver) {
      t.resizeObserver.disconnect();
      t.resizeObserver = null;
    }
    if (
      t.renderer &&
      mountRef.current &&
      mountRef.current.contains(t.renderer.domElement)
    ) {
      mountRef.current.removeChild(t.renderer.domElement);
    }
    if (t.renderer) t.renderer.dispose();
    threeRef.current = {
      scene: null,
      camera: null,
      renderer: null,
      ball: null,
      bowler: null,
      pitch: null,
      hitZone: null,
      rafId: null,
      resizeObserver: null,
    };
    setSceneReady(false);
  }

  function queueDelivery() {
    if (!enabled || !threeRef.current.ball) return;
    const now = performance.now();
    const s = stateRef.current;
    if (!s.deliveryReady) return;

    s.deliveryReady = false;
    s.ballActive = false;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = 0;
    s.hit = false;
    setResult({
      outcome: "in_queue",
      reactionMs: null,
      timing: null,
      show: false,
    });
    setBowlerPhase("RUNUP", now);
  }

  function spawnBall(nowTs) {
    const s = stateRef.current;
    const ball = threeRef.current.ball;
    if (!ball) return;
    const speed = BOWLING_SPEED[s.speedKey];

    s.ballActive = true;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = nowTs;
    s.lastTs = nowTs;
    s.hit = false;
    s.timingWindowMs = speed.windowMs;
    s.pos = { ...s.startPos };
    s.vel = {
      x: (Math.random() - 0.5) * 0.38,
      y: -0.2 + Math.random() * 0.2,
      z: speed.worldVz,
    };

    ball.visible = true;
    ball.position.set(s.pos.x, s.pos.y, s.pos.z);
    setBowlerPhase("RELEASE", nowTs);
    setResult({
      outcome: "in_flight",
      reactionMs: null,
      timing: null,
      show: false,
    });
  }

  useEffect(() => {
    stateRef.current.speedKey = speedKey;
  }, [speedKey]);

  useEffect(() => {
    if (!enabled) {
      disposeScene();
      return;
    }

    let cancelled = false;

    (() => {
      if (cancelled || !mountRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#060c14");

      const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 120);
      camera.position.set(0, 1.72, 2.05);
      camera.lookAt(0, 1.35, -8.5);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      mountRef.current.innerHTML = "";
      mountRef.current.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0x8cb7ff, 0.58);
      const keyLight = new THREE.DirectionalLight(0xa8e8ff, 0.95);
      keyLight.position.set(3, 7, 2);
      const fillLight = new THREE.DirectionalLight(0x44ffaa, 0.42);
      fillLight.position.set(-2, 4, -3);
      scene.add(ambient, keyLight, fillLight);

      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 26),
        new THREE.MeshStandardMaterial({
          color: 0x1d2a38,
          roughness: 0.78,
          metalness: 0.1,
        }),
      );
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.set(0, 0, -7.1);
      scene.add(pitch);

      const crease = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xa9cfff }),
      );
      crease.rotation.x = -Math.PI / 2;
      crease.position.set(0, 0.005, -0.05);
      scene.add(crease);

      const bowler = new THREE.Group();
      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.92, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5f84a8, roughness: 0.72 }),
      );
      torso.position.set(0, 0.95, 0);
      bowler.add(torso);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x7ea1c3, roughness: 0.7 }),
      );
      head.position.set(0, 1.68, 0);
      bowler.add(head);
      bowler.position.set(0.2, 0, -11.5);
      scene.add(bowler);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0xff4d4f,
          emissive: 0x330000,
          roughness: 0.45,
          metalness: 0.08,
        }),
      );
      ball.visible = false;
      scene.add(ball);

      const hitZone = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.3, 1.05),
        new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.1,
        }),
      );
      hitZone.position.set(0, 1.02, 0.35);
      scene.add(hitZone);

      const resize = () => {
        if (!mountRef.current || !renderer) return;
        const w = Math.max(320, mountRef.current.clientWidth);
        const h = Math.max(220, mountRef.current.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mountRef.current);

      threeRef.current = {
        scene,
        camera,
        renderer,
        ball,
        bowler,
        pitch,
        hitZone,
        rafId: null,
        resizeObserver: ro,
      };
      setSceneReady(true);
      resetForNextBall();

      const loop = (ts) => {
        const t = threeRef.current;
        const s = stateRef.current;
        if (!t.renderer || !t.scene || !t.camera) return;

        if (t.bowler) {
          if (s.phase === "IDLE") {
            t.bowler.position.z = -11.5;
            t.bowler.rotation.y = 0;
            t.bowler.rotation.z = 0;
          } else if (s.phase === "RUNUP") {
            const p = clamp((ts - s.phaseStartedTs) / s.runupMs, 0, 1);
            t.bowler.position.z = -11.5 + p * 2.2;
            t.bowler.position.x = 0.2 + Math.sin(p * Math.PI * 2.3) * 0.08;
            t.bowler.rotation.z = Math.sin(p * Math.PI * 6) * 0.05;
            if (p >= 1) {
              spawnBall(ts);
            }
          } else if (s.phase === "RELEASE") {
            t.bowler.rotation.z *= 0.85;
            if (ts - s.phaseStartedTs > 220) {
              setBowlerPhase("FOLLOW_THROUGH", ts);
            }
          } else if (s.phase === "FOLLOW_THROUGH") {
            const p = clamp((ts - s.phaseStartedTs) / 520, 0, 1);
            t.bowler.position.z = -9.3 + p * 0.8;
            t.bowler.rotation.z = (1 - p) * 0.12;
            if (p >= 1) {
              setBowlerPhase("RESET", ts);
            }
          } else if (s.phase === "RESET") {
            const p = clamp((ts - s.phaseStartedTs) / 450, 0, 1);
            t.bowler.position.z = -8.5 - p * 3.0;
            t.bowler.position.x = 0.2;
            if (p >= 1 && !s.ballActive) {
              setBowlerPhase("IDLE", ts);
              s.deliveryReady = true;
            }
          }
        }

        if (s.ballActive && t.ball && s.lastTs > 0) {
          const dt = Math.min((ts - s.lastTs) / 1000, 0.05);
          s.lastTs = ts;

          s.vel.y -= s.gravity * dt;
          s.pos.x += s.vel.x * dt;
          s.pos.y += s.vel.y * dt;
          s.pos.z += s.vel.z * dt;

          if (s.pos.y < 0.09 && !s.hit) {
            s.pos.y = 0.09;
            s.vel.y = Math.abs(s.vel.y) * 0.72;
            s.vel.z *= 0.88;
            s.vel.x *= 0.9;
          }

          t.ball.position.set(s.pos.x, s.pos.y, s.pos.z);

          const inZone =
            Math.abs(s.pos.x) <= 0.65 &&
            s.pos.y >= 0.2 &&
            s.pos.y <= 1.8 &&
            s.pos.z >= -0.25 &&
            s.pos.z <= 1.25;
          if (inZone && !s.zoneEntered) {
            s.zoneEntered = true;
            s.zoneEntryTs = ts;
          }

          if (s.zoneEntered && !s.hit) {
            const swingTs = swingRef.current.lastSwingTs || 0;
            if (swingTs > 0) {
              const delta = swingTs - s.zoneEntryTs;
              let hitType = null;
              if (Math.abs(delta) <= s.timingWindowMs * 0.45)
                hitType = "PERFECT";
              else if (
                delta < -s.timingWindowMs * 0.45 &&
                delta >= -s.timingWindowMs * 1.6
              )
                hitType = "EARLY";
              else if (
                delta > s.timingWindowMs * 0.45 &&
                delta <= s.timingWindowMs * 1.6
              )
                hitType = "LATE";

              if (hitType) {
                s.hit = true;
                registerOutcome(hitType, ts, delta);

                const swingForce = Math.min(
                  (swingRef.current.smoothVel || 0) / 1000,
                  1.8,
                );
                const basePower = 18 + swingForce * 12;
                s.vel.y = 4 + swingForce * 4;
                s.vel.z = -basePower;

                if (hitType === "EARLY") s.vel.x = -8 - Math.random() * 6;
                else if (hitType === "LATE") s.vel.x = 8 + Math.random() * 6;
                else s.vel.x = (Math.random() - 0.5) * 6;
              }
            }
          }

          if (
            !s.hit &&
            s.ballActive &&
            (s.pos.z > 1.8 || (s.pos.y < 0.1 && s.pos.z > 1.2))
          ) {
            s.ballActive = false;
            t.ball.visible = false;
            registerOutcome("MISS", ts, null);
          }

          if (
            s.hit &&
            s.ballActive &&
            (s.pos.z < -25 ||
              Math.hypot(s.pos.x, s.pos.y, s.pos.z) > 40 ||
              (s.pos.y < 0.09 && s.vel.y < 0.1 && s.pos.z < -5))
          ) {
            s.ballActive = false;
            t.ball.visible = false;
          }
        }

        if (result.show && ts - stateRef.current.resultTs > 1500) {
          setResult((prev) => ({ ...prev, show: false }));
        }

        t.renderer.render(t.scene, t.camera);
        t.rafId = requestAnimationFrame(loop);
      };

      threeRef.current.rafId = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      disposeScene();
    };
  }, [enabled, mountRef, swingRef]);

  return {
    sceneReady,
    speedKey,
    setSpeedKey,
    startDelivery: queueDelivery,
    result,
    deliveryCount,
    hitCount,
    bowlerState: stateLabel,
    canPlayNext: stateRef.current.deliveryReady,
    playNextBall: resetForNextBall,
  };
}
