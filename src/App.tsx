import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { io, Socket } from "socket.io-client"; 
export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const xrBtnRef = useRef<HTMLDivElement | null>(null);
  const [xrSupported, setXrSupported] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(`u_${Math.random().toString(36).slice(2, 10)}`);
  const [displayName, setDisplayName] = useState<string>(`Guest-${Math.floor(Math.random()*1000)}`);
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const nameRef = useRef<string>("");
  const tabTagRef = useRef<string>(""); 
  const remoteAvatarsRef = useRef<Record<string, THREE.Object3D>>({});
  const sceneRef = useRef<THREE.Scene | null>(null);
  const remoteGroupRef = useRef<THREE.Group | null>(null);
  const [roster, setRoster] = useState<Array<{ id: string; name: string; avatar?: { kind: 'color' | 'image' | 'model'; value: string } }>>([]);
  const remoteCursorsRef = useRef<Record<string, THREE.Mesh>>({});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const xrStatusRef = useRef<string>("Checking XR...");
  const peerConnsRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const remoteAudioRef = useRef<Record<string, { source: MediaStreamAudioSourceNode; panner: PannerNode }>>({});
  const remoteAudioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micLevelRafRef = useRef<number | null>(null);
  const [micLevel, setMicLevel] = useState<number>(0);
  const lastVoiceTsRef = useRef<number>(0);
  const [, forceRerender] = useState(0);
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const [authedUser, setAuthedUser] = useState<{ id: string; name: string; email: string; avatar: { kind: 'color' | 'image' | 'model'; value: string } } | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [avatarColor, setAvatarColor] = useState<string>("#4f46e5");
  const [sessionReady, setSessionReady] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login');
  const avatarGallery: string[] = [
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="%234f46e5"/><circle cx="64" cy="52" r="28" fill="%23fff"/><rect x="24" y="84" width="80" height="28" rx="14" fill="%23fff"/></svg>',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="%2310b981"/><circle cx="64" cy="50" r="26" fill="%23fef3c7"/><rect x="20" y="82" width="88" height="30" rx="15" fill="%23fef3c7"/></svg>',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="%23f97316"/><circle cx="64" cy="50" r="26" fill="%23fff"/><rect x="20" y="82" width="88" height="30" rx="15" fill="%23fff"/></svg>'
  ];

  useEffect(() => { setMounted(true); }, []);
  
  const swipeStartXRef = useRef<number | null>(null);
  const nextAvatar = () => setAvatarIdx((i) => (i + 1) % animatedAvatars.length);
  const prevAvatar = () => setAvatarIdx((i) => (i - 1 + animatedAvatars.length) % animatedAvatars.length);
  const [avatarImage, setAvatarImage] = useState<string>(avatarGallery[0]);
  const modelCacheRef = useRef<Record<string, { scene: THREE.Group; clips: THREE.AnimationClip[] }>>({});
  const localAvatarRef = useRef<THREE.Object3D | null>(null);
  const localMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const remoteMixersRef = useRef<Record<string, THREE.AnimationMixer>>({});
  const mouthTargetRef = useRef<THREE.Object3D | null>(null);
  const baseRotXRef = useRef<number>(0);
  const localActionsRef = useRef<{ idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; current?: 'idle'|'walk' }>({});
  const keysRef = useRef<Record<string, boolean>>({});
  const lastEmitRef = useRef<number>(0);
  const moveTargetRef = useRef<THREE.Vector3 | null>(null);
  const micMonitorRef = useRef<{ source: MediaStreamAudioSourceNode; gain: GainNode } | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const transcriptRef = useRef<string>("");
  const [summaries, setSummaries] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLog, setChatLog] = useState<Array<{userId:string; name:string; text:string; ts:number}>>([]);
  const [meetingEnded, setMeetingEnded] = useState<boolean>(false);
  const [medMode, setMedMode] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [mediaItems, setMediaItems] = useState<Array<{ name:string; url:string; type:string }>>([]);
  const [meetingStartTs, setMeetingStartTs] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState<number>(Date.now());
  const meetingEndedRef = useRef<boolean>(false);
  const chatSeenRef = useRef<Set<string>>(new Set());
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(false);
  // Collaborative doc + AI summary
  const [docOpen, setDocOpen] = useState<boolean>(false);
  const [docText, setDocText] = useState<string>("");
  const docDebounceRef = useRef<number | null>(null);
  const [summaryText, setSummaryText] = useState<string>("");
  const [summaryBusy, setSummaryBusy] = useState<boolean>(false);
  const [lobbyMode, setLobbyMode] = useState<'idle'|'created'|'use'>('idle');
  const [createdCode, setCreatedCode] = useState<string>('');
  const [meetings, setMeetings] = useState<Array<{ id:string; roomId:string|null; ts:number; title:string; summary:string[]; transcript:string; participants:Array<{id:string; name:string}>; whiteboardImage?:string; chat:Array<{userId:string; name:string; text:string; ts:number}> }>>([]);
  const recognitionRef = useRef<any>(null);
  const [sttAvailable, setSttAvailable] = useState<boolean>(true);
  const sttManualStopRef = useRef<boolean>(false);
  const [sttStatus, setSttStatus] = useState<'idle'|'running'|'stopped'|'unsupported'|'not_joined'>('idle');
  const [oauthBusy, setOauthBusy] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [avatarIdx, setAvatarIdx] = useState<number>(0);
  const animatedAvatars: string[] = [
    '/avatars/avatar1.jpg',
    '/avatars/avatar2.jpg',
    '/avatars/avatar3.jpg',
    '/avatars/avatar4.jpg',
    '/avatars/avatar5.jpg',
    '/avatars/avatar6.jpg'
  ];
  // Animated person GIF fallbacks (non-meeting backgrounds) for avatars
  const avatarFallbacks: string[] = [
    'https://media.giphy.com/media/f9k1tV7HyORcngKF8v/giphy.gif',
    'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
    'https://media.giphy.com/media/3o7aCRG4xJp4jOSAmk/giphy.gif',
    'https://media.giphy.com/media/xTiTnxpQ3ghPiB2Hp6/giphy.gif',
    'https://media.giphy.com/media/3o7aD0p7Yh7W5b7zI8/giphy.gif',
    'https://media.giphy.com/media/l0Exk8EUzSLsrErEQ/giphy.gif'
  ];

  // Convert a URL to a proxied direct image if possible
  const toImageSrc = (u: string): string => {
    try {
      const url = new URL(u);
      const host = url.host.toLowerCase();
      const path = url.pathname;
      const isImagePath = /(\.png|\.jpe?g|\.gif|\.webp|\.svg)$/i.test(path) || host.includes('i.pinimg.com');
      if (isImagePath) {
        const noScheme = (url.host + url.pathname + url.search).replace(/^\/+/, '');
        return 'https://images.weserv.nl/?url=' + encodeURIComponent(noScheme);
      }
      // For pin pages (pinterest.com/pin or pin.it short links), keep original (will hit onError -> fallback)
      return u;
    } catch {
      return u;
    }
  };
  // Focus the 3D scene and attach tracks as soon as we're joined
  useEffect(() => {
    if (!joined) return;
    setTimeout(() => { try { mountRef.current?.focus(); } catch {} }, 50);
    (async () => { try { await attachLocalTracksToAllPeers(); } catch {} })();
  }, [joined]);

  // Movement + animation loop: move local avatar toward target and update mixers
  useEffect(() => {
    if (!joined || meetingEnded) return;
    let stop = false;
    let last = performance.now();
    const loop = (ts: number) => {
      if (stop) return;
      const dt = Math.min(0.05, Math.max(0.0, (ts - last) / 1000));
      last = ts;
      try {
        // Update local movement toward target
        const avatar = localAvatarRef.current;
        const target = moveTargetRef.current;
        if (avatar && target) {
          const dx = target.x - avatar.position.x;
          const dz = target.z - avatar.position.z;
          const dist = Math.hypot(dx, dz);
          const speed = 2.0; // meters/sec
          if (dist > 0.02) {
            const vx = (dx / dist) * speed * dt;
            const vz = (dz / dist) * speed * dt;
            avatar.position.x += vx;
            avatar.position.z += vz;
            // Face movement direction smoothly
            const desiredYaw = Math.atan2(vx, vz);
            const curYaw = avatar.rotation.y;
            let deltaYaw = desiredYaw - curYaw;
            while (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
            while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;
            avatar.rotation.y = curYaw + deltaYaw * Math.min(1, 10 * dt);
            // Switch to walk anim if available
            const acts = localActionsRef.current;
            if (acts && acts.walk && acts.current !== 'walk') {
              try { acts.idle?.fadeOut?.(0.15); acts.walk.reset().fadeIn?.(0.15).play(); acts.current = 'walk'; } catch {}
            }
          } else {
            // Arrived: switch to idle
            const acts = localActionsRef.current;
            if (acts && acts.idle && acts.current !== 'idle') {
              try { acts.walk?.fadeOut?.(0.15); acts.idle.reset().fadeIn?.(0.15).play(); acts.current = 'idle'; } catch {}
            }
          }
        }
        // Update mixers
        if (localMixerRef.current) {
          try { localMixerRef.current.update(dt); } catch {}
        }
        const mixers = remoteMixersRef.current || {} as any;
        for (const k of Object.keys(mixers)) {
          const m = mixers[k];
          try { m.update?.(dt); } catch {}
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => { stop = true; cancelAnimationFrame(id); };
  }, [joined, meetingEnded]);

  // If peers already exist, add local tracks to all of them (for pre-warmed media)
  const attachLocalTracksToAllPeers = async () => {
    const st = mediaStreamRef.current;
    if (!st) return;
    const conns = peerConnsRef.current;
    for (const pid of Object.keys(conns)) {
      const pc = conns[pid];
      const haveAudio = pc.getSenders().some(s => s.track?.kind === 'audio');
      const haveVideo = pc.getSenders().some(s => s.track?.kind === 'video');
      let added = false;
      if (!haveAudio) {
        const a = st.getAudioTracks()[0];
        if (a) { try { pc.addTrack(a, st); added = true; } catch {} }
      }
      if (!haveVideo) {
        const v = st.getVideoTracks()[0];
        if (v) { try { pc.addTrack(v, st); added = true; } catch {} }
      }
      if (added) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('webrtc:signal', { to: pid, from: userIdRef.current, data: pc.localDescription });
        } catch {}
      }
    }
  };

  
  // Pre-warm mic+camera on initial load to trigger permission prompt
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        mediaStreamRef.current = stream;
        const atr = stream.getAudioTracks()[0];
        const vtr = stream.getVideoTracks()[0];
        setMicEnabled(!!atr && atr.readyState === 'live');
        setCamEnabled(!!vtr && vtr.readyState === 'live');
        if (videoRef.current) { try { videoRef.current.srcObject = stream; await videoRef.current.play(); } catch {} }
        await attachLocalTracksToAllPeers();
      } catch {
        // Do not surface the generic error string; permissions may be denied until user changes settings
        setMicEnabled(false); setCamEnabled(false);
      }
    })();
  }, []);
  // (whiteboard setup effect moved below wbOpen declaration)
  // Start/stop meeting timer without altering existing join/end logic
  useEffect(() => {
    if (joined && !meetingEnded && !meetingStartTs) {
      setMeetingStartTs(Date.now());
    }
  }, [joined, meetingEnded]);
  useEffect(() => {
    if (!meetingStartTs || meetingEnded) return;
    const id = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [meetingStartTs, meetingEnded]);
  const timerText = (() => {
    if (!meetingStartTs) return '00:00:00';
    const diff = Math.max(0, Math.floor((timerNow - meetingStartTs) / 1000));
    const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  })();
  const downloadCurrentNotes = () => {
    const text = [
      `Title: Meeting ${new Date().toLocaleString()}`,
      `Room: ${roomId || '-'}`,
      '',
      'Summary:',
      ...(summaries||[]).map(s=>`- ${s}`),
      '',
      'Transcript:',
      (transcriptRef.current || transcript || '(empty)')
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `meeting_notes_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
  };
  const downloadWhiteboardNow = () => {
    try {
      const c = wbCanvasRef.current; if (!c) return;
      const url = c.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = `whiteboard_${Date.now()}.png`; a.click();
    } catch {}
  };
  // Auto-advance avatars while onboarding is open to create a subtle moving effect
  useEffect(() => {
    if (!onboardingOpen) return;
    const id = window.setInterval(() => {
      setAvatarIdx((i) => (i + 1) % animatedAvatars.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [onboardingOpen, animatedAvatars.length]);
  const [phoneOpen, setPhoneOpen] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [phoneErr, setPhoneErr] = useState<string>('');
  const phoneConfirmRef = useRef<any>(null);
  const firebaseConfig = {
    apiKey: "AIzaSyDAS8zxN79b10XiC3LLttsAAAXkV3CfGiU",
    authDomain: "meeting-c1acc.firebaseapp.com",
    projectId: "meeting-c1acc",
    storageBucket: "meeting-c1acc.firebasestorage.app",
    messagingSenderId: "626500822927",
    appId: "1:626500822927:web:386953394734db44c70dfa"
  };

  const sendPhoneOtp = async () => {
    try {
      setOauthBusy(true);
      await ensureFirebase();
      const fb = (window as any).firebase;
      const auth = fb.auth();
      setPhoneErr('');
      // Create or reuse a visible reCAPTCHA verifier so challenges are obvious during testing
      let verifier: any = (window as any).__recaptchaVerifier;
      if (!verifier) {
        verifier = new fb.auth.RecaptchaVerifier(
          'recaptcha-container',
          { size: 'normal' },
          auth
        );
        (window as any).__recaptchaVerifier = verifier;
      }
      try { await verifier.render(); } catch {}
      const confirmation = await auth.signInWithPhoneNumber(phoneNumber, verifier);
      phoneConfirmRef.current = confirmation;
      alert('OTP sent to your phone');
    } catch (e: any) {
      setPhoneErr(e?.message || 'Failed to send OTP');
      alert('Failed to send OTP: ' + (e?.message || 'unknown error'));
    } finally {
      setOauthBusy(false);
    }
  };

  const verifyPhoneOtp = async () => {
    try {
      setOauthBusy(true);
      const confirmation = phoneConfirmRef.current;
      if (!confirmation) { alert('Please request OTP first'); return; }
      const res = await confirmation.confirm(otpCode);
      const user = res?.user;
      if (user) {
        const profile = {
          id: user.uid,
          name: user.displayName || 'User',
          email: user.phoneNumber || 'phone-user',
          avatar: { kind: 'image' as const, value: avatarGallery[0] }
        };
        setAuthedUser(profile);
        setDisplayName(profile.name);
        localStorage.setItem('authUser', JSON.stringify(profile));
        sessionStorage.setItem('sessionAuthed','1');
        setSessionReady(true);
        setAuthOpen(false);
        setOnboardingOpen(true);
        setPhoneOpen(false);
      }
    } catch (e: any) {
      setPhoneErr(e?.message || 'OTP verification failed');
      alert('OTP verification failed: ' + (e?.message || 'unknown error'));
    } finally {
      setOauthBusy(false);
    }
  };
  const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src));
    document.head.appendChild(s);
  });
  const ensureFirebase = async () => {
    if (!(window as any).firebase?.apps?.length) {
      await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');
      (window as any).firebase.initializeApp(firebaseConfig);
    }
  };
  const signInWithProvider = async (provider: 'google'|'facebook') => {
    try {
      setOauthBusy(true);
      await ensureFirebase();
      const fb = (window as any).firebase;
      const auth = fb.auth();
      const prov = provider === 'google' ? new fb.auth.GoogleAuthProvider() : new fb.auth.FacebookAuthProvider();
      const res = await auth.signInWithPopup(prov);
      const user = res.user;
      if (user) {
        const profile = {
          id: user.uid,
          name: user.displayName || 'User',
          email: user.email || 'user@example.com',
          avatar: { kind: 'image' as const, value: user.photoURL || avatarGallery[0] }
        };
        setAuthedUser(profile);
        setDisplayName(profile.name);
        localStorage.setItem('authUser', JSON.stringify(profile));
        sessionStorage.setItem('sessionAuthed','1');
        setSessionReady(true);
        setAuthOpen(false);
        setOnboardingOpen(true);
      }
    } catch (e:any) {
      alert('OAuth failed: ' + (e?.message || 'unknown error'));
    } finally {
      setOauthBusy(false);
    }
  };
  const startRecognition = async () => {
    try {
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { setSttAvailable(false); setSttStatus('unsupported'); return; }
      // Start regardless of room state so preview always works
      sttManualStopRef.current = false;
      // Ensure mic permission is prompted so SR has audio
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
      if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} return; }
      const rec: any = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = (navigator.language || 'en-US');
      let buffer = '';
      rec.onresult = (e: any) => {
        let interim = '';
        let finalAdded = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) { finalAdded += res[0].transcript + ' '; buffer += res[0].transcript + ' '; }
          else interim += res[0].transcript;
        }
        // Show raw text (final + interim) without any filtering
        const full = (buffer + ' ' + interim).trim();
        transcriptRef.current = full;
        setTranscript(full);
        // Emit only newly added final chunk to server so others see it
        if (finalAdded.trim()) {
          try {
            const chunk = finalAdded.trim();
            socketRef.current?.emit('stt:segment', { text: chunk });
          } catch {}
        }
      };
      rec.onerror = (e: any) => {
        const name = (e?.error || '').toString();
        if (name.includes('not-allowed') || name.includes('service-not-allowed')) return;
        if (!sttManualStopRef.current) { try { rec.start(); } catch {} }
      };
      rec.onend = () => { if (!meetingEnded && !sttManualStopRef.current) { try { rec.start(); } catch {} } };
      try { rec.start(); } catch {}
      recognitionRef.current = rec;
      setSttStatus('running');
    } catch {}
  };
  // Whiteboard state
  const [wbOpen, setWbOpen] = useState<boolean>(false);
  const wbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wbColor, setWbColor] = useState<string>("#1f2937");
  const [wbSize, setWbSize] = useState<number>(4);
  const [micBusy, setMicBusy] = useState<boolean>(false);
  const [camBusy, setCamBusy] = useState<boolean>(false);
  const wbDrawingRef = useRef<boolean>(false);
  const wbPointsRef = useRef<Array<[number, number]>>([]);
  const wbCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const wbToolRef = useRef<'pencil'|'brush'|'marker'|'eraser'|'airbrush'|'fill'>('pencil');
  const wbLastEmitRef = useRef<number>(0);
  const modelUrls = [
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb'
  ];

  const modelUrlForAvatar = (val: string) => {
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) return val;
    const idx = Math.max(0, avatarGallery.indexOf(val));
    return modelUrls[idx % modelUrls.length];
  };
  const handleWbTouchEnd = () => {
    if (!wbDrawingRef.current) return;
    wbDrawingRef.current = false;
    const pts = wbPointsRef.current.slice();
    wbPointsRef.current = [];
    if (pts.length > 1) {
      socketRef.current?.emit('whiteboard:stroke', { color: wbColor, size: wbSize, points: pts, tool: wbToolRef.current });
    } else if (pts.length === 1) {
      const p = pts[0];
      socketRef.current?.emit('whiteboard:stroke', { color: wbColor, size: wbSize, points: [p, [p[0]+0.01, p[1]+0.01]], tool: wbToolRef.current });
    }
  };

  const loadModel = async (url: string): Promise<{ group: THREE.Group; clips: THREE.AnimationClip[] }> => {
    if (modelCacheRef.current[url]) {
      const cached = modelCacheRef.current[url];
      return { group: cached.scene.clone(true) as THREE.Group, clips: cached.clips };
    }
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => loader.load(url, resolve, undefined, reject));
      const scene: THREE.Group = gltf.scene || new THREE.Group();
      const clips: THREE.AnimationClip[] = gltf.animations || [];
      modelCacheRef.current[url] = { scene, clips };
      return { group: scene.clone(true) as THREE.Group, clips };
    } catch (e) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 6, 12), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
      body.castShadow = true;
      g.add(body);
      return { group: g, clips: [] };
    }
  };

  const lastPoseRef = useRef<Record<string, { p: [number, number, number]; r: [number, number, number] }>>({});

  useEffect(() => {
    const saved = localStorage.getItem('authUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAuthedUser(parsed);
        setDisplayName(parsed.name || displayName);
      } catch {}
    }
    const session = sessionStorage.getItem('sessionAuthed');
    // Ensure a stable per-tab suffix for visible names
    let tabTag = sessionStorage.getItem('tabTag');
    if (!tabTag) { tabTag = Math.random().toString(36).slice(2,5); sessionStorage.setItem('tabTag', tabTag); }
    tabTagRef.current = tabTag;
    setSessionReady(session === '1');
    if (session !== '1') setAuthOpen(true);
    const lastRoom = sessionStorage.getItem('lastRoomId');
    if (lastRoom) {
      setRoomCodeInput(lastRoom);
      setRoomId(lastRoom);
    }
    const wasJoined = sessionStorage.getItem('joined') === '1';
    if (wasJoined) setJoined(true);
    if (!mountRef.current) return;

    const container = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    // expose renderer for potential debug
    (renderer.domElement as any).__threeRenderer = renderer;
    rendererRef.current = renderer;

    // Skip adding VRButton; we run in non-XR by default and optionally show status only

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    scene.add(dir);

    // Simple virtual room: floor + walls
    const room = new THREE.Group();
    scene.add(room);
    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });
    const wallGeo = new THREE.PlaneGeometry(12, 3);
    const wall1 = new THREE.Mesh(wallGeo, wallMat);
    wall1.position.set(0, 1.5, -6);
    room.add(wall1);
    const wall2 = new THREE.Mesh(wallGeo, wallMat);
    wall2.position.set(0, 1.5, 6);
    wall2.rotation.y = Math.PI;
    room.add(wall2);
    const wall3 = new THREE.Mesh(wallGeo, wallMat);
    wall3.position.set(-6, 1.5, 0);
    wall3.rotation.y = Math.PI / 2;
    room.add(wall3);
    const wall4 = new THREE.Mesh(wallGeo, wallMat);
    wall4.position.set(6, 1.5, 0);
    wall4.rotation.y = -Math.PI / 2;
    room.add(wall4);

    // Ground + Grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(50, 50, 0x94a3b8, 0xe2e8f0); // slate-400 / slate-200
    scene.add(grid);

    // Demo content: spinning box avatar placeholder
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5 }) // indigo-600
    );
    box.position.set(0, 0.5, 0);
    box.castShadow = true;
    box.name = 'placeholderBox';
    scene.add(box);

    // Group to hold remote avatars
    const remoteGroup = new THREE.Group();
    scene.add(remoteGroup);
    remoteGroupRef.current = remoteGroup;

    // Orbit controls for non-XR
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;

    let rafId = 0;
    const onKey = (e: KeyboardEvent) => {
      if (meetingEndedRef.current) return;
      const k = (e?.key || '').toLowerCase();  
      if (!k) return;
      // Do not capture movement keys when typing in form fields
      const target = e.target as HTMLElement | null;
      const isEditable = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable ||
        (typeof (target as any).closest === 'function' && !!(target as any).closest('input, textarea, [contenteditable="true"], [contenteditable]'))
      );
      if (isEditable) return;
      const down = e.type === 'keydown';
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        keysRef.current[k] = down;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    // Click-to-move: project mouse to ground plane and set move target
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const onPointerDown = (e: MouseEvent) => {
      if (meetingEndedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        moveTargetRef.current = new THREE.Vector3(hit.x, 0, hit.z);
      }
    };
    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (localMixerRef.current) localMixerRef.current.update(dt);
      Object.values(remoteMixersRef.current).forEach((m) => m.update(dt));
      // Local avatar movement (WASD)
      const av = localAvatarRef.current;
      if (av) {
        if (!meetingEnded) {
          let vx = 0, vz = 0;
          const k = keysRef.current;
          if (k['w'] || k['arrowup']) vz -= 1;
          if (k['s'] || k['arrowdown']) vz += 1;
          if (k['a'] || k['arrowleft']) vx -= 1;
          if (k['d'] || k['arrowright']) vx += 1;
          // Click-to-move: steer toward target
          if (moveTargetRef.current) {
            const dx = moveTargetRef.current.x - av.position.x;
            const dz = moveTargetRef.current.z - av.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 0.02) { vx += dx / dist; vz += dz / dist; } else { moveTargetRef.current = null; }
          }
          if (vx !== 0 || vz !== 0) {
            const len = Math.hypot(vx, vz) || 1;
            vx /= len; vz /= len;
            const speed = 1.5; // m/s
            av.position.x += vx * speed * dt;
            av.position.z += vz * speed * dt;
            // animation blend
            const acts = localActionsRef.current;
            if (acts.walk && acts.current !== 'walk') {
              acts.idle?.crossFadeTo(acts.walk, 0.25, false);
              acts.walk.play();
              acts.current = 'walk';
            }
          } else {
            const acts = localActionsRef.current;
            if (acts.idle && acts.current !== 'idle') {
              acts.walk?.crossFadeTo(acts.idle, 0.25, false);
              acts.idle.play();
              acts.current = 'idle';
            }
          }
          // Simple lip/mouth movement: modulate slight X rotation by mic level
          try {
            const base = baseRotXRef.current || 0;
            av.rotation.x = base + (micLevel || 0) * 0.08;
          } catch {}
          // emit pose at 10 Hz
          const now = performance.now();
          if (socketRef.current && now - lastEmitRef.current > 100) {
            lastEmitRef.current = now;
            const r = new THREE.Euler().copy(av.rotation);
            const p: [number, number, number] = [av.position.x, av.position.y, av.position.z];
            const rot: [number, number, number] = [r.x, r.y, r.z];
            socketRef.current.emit('avatar:pose', { userId: userIdRef.current, p, r: rot });
          }
        } else {
          moveTargetRef.current = null;
        }
      }
      controls.update();
      renderer.render(scene, camera);
    });

    // Socket listeners are now attached in the room socket effect
    // Socket listeners are attached in the room socket effect

    // Detect XR support with retries (helps when emulator extension initializes late)
    let checks = 0;
    const checkXr = () => {
      if ((navigator as any).xr?.isSessionSupported) {
        (navigator as any).xr
          .isSessionSupported("immersive-vr")
          .then((supported: boolean) => setXrSupported(supported))
          .catch(() => setXrSupported(false));
      }
      if (checks++ < 10) setTimeout(checkXr, 1000);
    };
    checkXr();
    xrStatusRef.current = 'XR check running';

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      renderer.domElement.removeEventListener('mousedown', onPointerDown);
      renderer.setAnimationLoop(null as never);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Emit doc updates with debounce to avoid spamming
  const emitDocUpdate = (text: string) => {
    if (!socketRef.current) return;
    if (docDebounceRef.current) cancelAnimationFrame(docDebounceRef.current);
    docDebounceRef.current = requestAnimationFrame(() => {
      socketRef.current?.emit('doc:update', { text });
    });
  };

  // Request initial doc + transcript when joining a room
  useEffect(() => {
    if (!socketRef.current || !joined || !roomId) return;
    try { socketRef.current.emit('doc:requestState'); } catch {}
    try { socketRef.current.emit('stt:requestState'); } catch {}
  }, [joined, roomId]);

  // WebXR helpers (optional)
  const xrSessionRef = useRef<any>(null);
  const [xrInSession, setXrInSession] = useState<boolean>(false);
  const enterXR = async () => {
    try {
      const xr: any = (navigator as any).xr;
      if (!xr) { alert('WebXR not available in this browser/device.'); return; }
      if (!xr.isSessionSupported) { alert('WebXR API not supported.'); return; }
      const supported = await xr.isSessionSupported('immersive-vr');
      if (!supported) { alert('Immersive VR not supported on this device.'); return; }
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      session.addEventListener('end', () => { xrSessionRef.current = null; setXrInSession(false); });
      await rendererRef.current?.xr.setSession(session);
      xrSessionRef.current = session;
      setXrInSession(true);
    } catch (e) {
      alert('Failed to enter XR.');
    }
  };
  const exitXR = async () => {
    try {
      const sess = xrSessionRef.current || rendererRef.current?.xr.getSession();
      if (sess) await sess.end();
    } catch {}
  };
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') exitXR(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Ensure a 3D avatar is loaded for the local user by default
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (localAvatarRef.current) return;
    const selected = authedUser?.avatar?.value || avatarImage;
    const url = modelUrlForAvatar(selected);
    (async () => {
      const { group: obj, clips } = await loadModel(url);
      obj.traverse((o) => { (o as any).castShadow = true; });
      scene.add(obj);
      localAvatarRef.current = obj;
      baseRotXRef.current = obj.rotation.x || 0;
      if (clips && clips.length) {
        localMixerRef.current = new THREE.AnimationMixer(obj);
        const idle = clips[0];
        const walk = clips[1];
        const idleAct = localMixerRef.current.clipAction(idle);
        idleAct.play();
        const walkAct = walk ? localMixerRef.current.clipAction(walk) : undefined;
        localActionsRef.current = { idle: idleAct, walk: walkAct, current: 'idle' };
      }
      const placeholder = scene.getObjectByName('placeholderBox');
      if (placeholder) placeholder.visible = false;
    })();
  }, [authedUser, avatarImage]);

  // Socket.io: join room and sync avatar pose
  useEffect(() => {
    if (!roomId || !joined) return;
    const socket = io("http://localhost:3001", { transports: ["websocket"], withCredentials: false });
    socketRef.current = socket;
    // Per-tab tag to avoid identical visible names across tabs
    const baseName = nameRef.current || displayName;
    const nameToUse = `${baseName}-${tabTagRef.current || ''}`;
    const avatar = authedUser?.avatar || { kind: 'image', value: avatarGallery[0] };
    socket.emit("room:join", { roomId, userId: userIdRef.current, name: nameToUse, avatar });
    // Ensure new joiners sync the current whiteboard state immediately
    socket.emit('whiteboard:requestState');
    socket.emit('media:requestState');
    socket.on('media:state', (payload:any) => {
      try {
        const items = (payload?.items || []).map((m:any) => ({ name: m.name, url: m.dataUrl, type: m.type }));
        setMediaItems(items);
      } catch {}
    });
    socket.on('media:add', (payload:any) => {
      try {
        const items = (payload?.items || []).map((m:any) => ({ name: m.name, url: m.dataUrl, type: m.type }));
        if (items.length) setMediaItems(prev => [...prev, ...items]);
      } catch {}
    });

    // Docs, AI summary, and transcript wiring
    socket.on('doc:state', (payload: any) => {
      try { setDocText(payload?.text || ""); } catch {}
    });
    socket.on('doc:update', (payload: any) => {
      try { setDocText(payload?.text || ""); } catch {}
    });
    socket.on('ai:summary', (payload: any) => {
      try { setSummaryText(payload?.summary || ""); } catch {}
      setSummaryBusy(false);
    });
    socket.on('stt:state', (payload: any) => {
      try {
        const segs = (payload?.segments || []).map((s: any) => s.text).join(' ');
        transcriptRef.current = segs;
        setTranscript(segs);
      } catch {}
    });
    socket.on('stt:segment', (entry: any) => {
      try {
        const next = (transcriptRef.current ? (transcriptRef.current + ' ') : '') + (entry?.text || '');
        transcriptRef.current = next;
        setTranscript(next);
      } catch {}
    });

    socket.on("presence:roster", (members: Array<{ id: string; name: string; avatar?: { kind: 'color' | 'image' | 'model'; value: string } }>) => {
      setRoster(members);
      members.forEach((m: { id: string; name: string }) => maybeStartPeer(m.id));
    });
    socket.on("presence:join", (user: any) => {
      setRoster((prev: Array<{ id: string; name: string; avatar?: { kind: 'color' | 'image' | 'model'; value: string } }>) => {
        const exists = prev.some((m: { id: string; name: string }) => m.id === user.id);
        return exists ? prev : [...prev, user];
      });
      maybeStartPeer(user.id);
    });
    socket.on("presence:update", (user: { id: string; name: string; avatar?: { kind: 'color' | 'image' | 'model'; value: string } }) => {
      setRoster((prev: Array<{ id: string; name: string; avatar?: { kind: 'color' | 'image' | 'model'; value: string } }>) =>
        prev.map((m) => (m.id === user.id ? { ...m, avatar: user.avatar, name: user.name } : m))
      );
      if (user.id === userIdRef.current) {
        // Update own profile but do not create a remote avatar for self
        setAuthedUser((prevU) => (prevU ? { ...prevU, avatar: user.avatar || prevU.avatar } : prevU));
        // If an accidental remote avatar for self exists, remove it
        const selfRemote = remoteAvatarsRef.current[user.id];
        if (selfRemote && selfRemote.parent) selfRemote.parent.remove(selfRemote);
        delete remoteAvatarsRef.current[user.id];
        if (remoteMixersRef.current[user.id]) delete remoteMixersRef.current[user.id];
        return;
      }
      const group = remoteGroupRef.current;
      const scene = sceneRef.current;
      if (!group || !scene) return;
      const existing = remoteAvatarsRef.current[user.id];
      if (existing && existing.parent) existing.parent.remove(existing);
      delete remoteAvatarsRef.current[user.id];
      if (remoteMixersRef.current[user.id]) delete remoteMixersRef.current[user.id];
      let url = modelUrls[0];
      if (user?.avatar?.kind === 'model') url = user.avatar.value as any;
      else url = modelUrlForAvatar(user?.avatar?.value || avatarGallery[0]);
      (async () => {
        const { group: obj, clips } = await loadModel(url);
        obj.traverse((o) => { (o as any).castShadow = true; });
        remoteAvatarsRef.current[user.id] = obj;
        group.add(obj);
        if (clips && clips.length) {
          const mixer = new THREE.AnimationMixer(obj);
          remoteMixersRef.current[user.id] = mixer;
          const idle = clips[0];
          mixer.clipAction(idle).play();
        }
        const last = lastPoseRef.current[user.id];
        if (last) {
          obj.position.set(last.p[0], last.p[1], last.p[2]);
          obj.rotation.set(last.r[0], last.r[1], last.r[2]);
        }
      })();
    });
    socket.on("presence:leave", (user: any) => {
      const mesh = remoteAvatarsRef.current[user.id];
      if (mesh && mesh.parent) mesh.parent.remove(mesh);
      delete remoteAvatarsRef.current[user.id];
      setRoster((prev: Array<{ id: string; name: string }>) => prev.filter((m: { id: string; name: string }) => m.id !== user.id));
      teardownPeer(user.id);
    });

    // handle remote avatar poses
    socket.on("avatar:pose", (data: { userId: string; p: [number, number, number]; r: [number, number, number]; }) => {
      if (data.userId === userIdRef.current) return; // never render self as remote
      const scene = sceneRef.current;
      const group = remoteGroupRef.current;
      if (!scene || !group) return;
      const { userId, p, r } = data;
      let mesh = remoteAvatarsRef.current[userId];
      if (!mesh) {
        const member = roster.find((m) => m.id === userId);
        let url = modelUrls[0];
        if (member?.avatar?.kind === 'model') url = member.avatar.value as any;
        else url = modelUrlForAvatar(member?.avatar?.value || avatarGallery[0]);
        (async () => {
          const { group: obj, clips } = await loadModel(url);
          obj.traverse((o) => { (o as any).castShadow = true; });
          remoteAvatarsRef.current[userId] = obj;
          group.add(obj);
          if (clips && clips.length) {
            const mixer = new THREE.AnimationMixer(obj);
            remoteMixersRef.current[userId] = mixer;
            mixer.clipAction(clips[0]).play();
          }
          obj.position.set(p[0], p[1], p[2]);
          obj.rotation.set(r[0], r[1], r[2]);
        })();
        return;
      }
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.set(r[0], r[1], r[2]);
      lastPoseRef.current[userId] = { p, r };
      const audio = remoteAudioRef.current[userId];
      if (audio) audio.panner.positionX.value = p[0], audio.panner.positionY.value = p[1], audio.panner.positionZ.value = p[2];
    });

    // remote cursor positions
    socket.on("cursor:pos", (data: { userId: string; p: [number, number, number]; }) => {
      const scene = sceneRef.current;
      if (!scene) return;
      let cursor = remoteCursorsRef.current[data.userId];
      if (!cursor) {
        cursor = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.5 })
        );
        remoteCursorsRef.current[data.userId] = cursor;
        scene.add(cursor);
      }
      cursor.position.set(data.p[0], data.p[1], data.p[2]);
    });

    // Whiteboard + Chat listeners (registered after connection)
    socket.on('whiteboard:stroke', (s: { color: string; size: number; points: Array<[number,number]>; tool?: string }) => {
      if (meetingEndedRef.current) return;
      drawStrokeOnCanvas(s);
    });
    socket.on('whiteboard:clear', () => {
      if (meetingEndedRef.current) return;
      clearWhiteboardCanvas();
    });
    socket.on('whiteboard:fill', (act: { x:number; y:number; color:string }) => {
      if (meetingEndedRef.current) return;
      floodFillAt(Math.floor(act.x), Math.floor(act.y), act.color);
    });
    socket.on('whiteboard:state', (state: { actions: Array<any> } ) => {
      if (meetingEndedRef.current) return;
      clearWhiteboardCanvas();
      for (const act of (state.actions || [])) {
        if (act.type === 'stroke') drawStrokeOnCanvas(act);
        if (act.type === 'fill') floodFillAt(Math.floor(act.x), Math.floor(act.y), act.color);
      }
    });
    socket.on('chat:message', (msg: {userId:string; name:string; text:string; ts:number; cid?: string}) => {
      if (meetingEndedRef.current) return;
      if (msg.cid) {
        if (chatSeenRef.current.has(msg.cid)) return;
        chatSeenRef.current.add(msg.cid);
      }
      setChatLog((prev) => [...prev, msg]);
    });

    socket.on('transcript:ready', (payload: { roomId?: string; file?: string; ok?: boolean; transcriptText?: string }) => {
      if (!payload || payload.ok === false) return;
      try {
        const text = payload.transcriptText || '';
        // Update last saved meeting with full transcript
        try {
          const raw = localStorage.getItem('meetings') || '[]';
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length) {
            let idx = -1;
            if (lastMeetingIdRef.current) {
              idx = arr.findIndex((m: any) => m.id === lastMeetingIdRef.current);
            }
            if (idx < 0) {
              // fallback: pick latest meeting for the same room
              for (let i = arr.length - 1; i >= 0; i--) { if (arr[i]?.roomId === (payload.roomId || roomId)) { idx = i; break; } }
            }
            if (idx >= 0) {
              arr[idx].transcript = text;
              localStorage.setItem('meetings', JSON.stringify(arr));
              setMeetings(arr);
            }
          }
        } catch {}
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(payload.roomId || roomId || 'room')}-transcript.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); try { a.remove(); } catch {} }, 1000);
      } catch {}
    });

    const interval = setInterval(() => {
      if (meetingEndedRef.current) return;
      if (!localAvatarRef.current) return;
      const p: [number, number, number] = [localAvatarRef.current.position.x, localAvatarRef.current.position.y, localAvatarRef.current.position.z];
      const r: [number, number, number] = [localAvatarRef.current.rotation.x, localAvatarRef.current.rotation.y, localAvatarRef.current.rotation.z];
      socket.emit('avatar:pose', { userId: userIdRef.current, p, r });
    }, 100);

    socket.on("webrtc:signal", async ({ from, data }: any) => {
      if (!from || from === userIdRef.current) return;
      const pc = await ensurePeer(from);
      try {
        if (data?.type === "offer") {
          const offerCollision = pc.signalingState !== "stable";
          const polite = userIdRef.current > from; // deterministic tie-breaker
          if (offerCollision) {
            if (!polite) return; // ignore non-polite collisions
            await pc.setLocalDescription({ type: "rollback" } as any);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc:signal", { to: from, from: userIdRef.current, data: pc.localDescription });
        } else if (data?.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          }
        } else if (data?.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data)); } catch {}
        }
      } catch {}
    });

    return () => {
      clearInterval(interval);
      socketRef.current?.off('whiteboard:stroke');
      socketRef.current?.off('whiteboard:clear');
      socketRef.current?.off('whiteboard:state');
      socketRef.current?.off('whiteboard:fill');
      socketRef.current?.off('chat:message');
      try {
        socket.off('doc:state');
        socket.off('doc:update');
        socket.off('ai:summary');
        socket.off('stt:state');
        socket.off('stt:segment');
        socket.off('transcript:ready');
      } catch {}
      socket.disconnect();
      setRoster([]);
      setChatLog([]);
      // Clear remote avatar refs
      try {
        Object.keys(remoteAvatarsRef.current).forEach((id) => { delete remoteAvatarsRef.current[id]; });
        Object.keys(remoteMixersRef.current).forEach((id) => { delete remoteMixersRef.current[id]; });
      } catch {}
      setSummaryText("");
    };
  }, [roomId, joined]);

  // On first user gesture, aggressively resume remote audio and start STT if idle
  useEffect(() => {
    const onFirstClick = async () => {
      await resumeAllRemoteAudio();
      try {
        if (joined && !meetingEnded && sttAvailable) {
          if (recognitionRef.current) { recognitionRef.current.start?.(); }
        }
      } catch {}
    };
    window.addEventListener('click', onFirstClick, { once: true });
    return () => { window.removeEventListener('click', onFirstClick as any); };
  }, [joined, meetingEnded, sttAvailable]);

  // STT watchdog: ensure SR keeps running during the meeting
  useEffect(() => {
    if (!joined || meetingEnded || !sttAvailable) return;
    const id = window.setInterval(() => {
      try {
        const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = recognitionRef.current;
        // Try to start if not present or status isn’t running
        if (!rec) return;
        // Some browsers throw if already started; harmless
        rec.start?.();
      } catch {}
    }, 5000);
    return () => window.clearInterval(id);
  }, [joined, meetingEnded, sttAvailable]);

  // Re-acquire and reattach tracks when devices change (e.g., user plugs/unplugs mic/cam)
  useEffect(() => {
    const handler = async () => {
      if (!joined) return;
      try {
        await ensureMediaIfNeeded();
        const st = mediaStreamRef.current;
        const atrack = st?.getAudioTracks()[0] || null;
        const vtrack = st?.getVideoTracks()[0] || null;
        await replaceAudioTrackForAll(atrack);
        await replaceVideoTrackForAll(vtrack);
        await resumeAllRemoteAudio();
      } catch {}
    };
    try { navigator.mediaDevices?.addEventListener?.('devicechange', handler as any); } catch {}
    return () => { try { navigator.mediaDevices?.removeEventListener?.('devicechange', handler as any); } catch {} };
  }, [joined]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatLog, chatOpen]);

  useEffect(() => { loadMeetings(); }, []);
  useEffect(() => { meetingEndedRef.current = meetingEnded; }, [meetingEnded]);

  const nameForUserId = (uid: string): string => {
    if (uid === userIdRef.current) return authedUser?.name || displayName;
    const m = roster.find(r => r.id === uid);
    return m?.name || 'Guest';
  };

  // Map any avatar to a visible image representation
  const imageForAvatar = (av: { kind: 'color'|'image'|'model'; value: string } | undefined): string => {
    if (!av) return avatarGallery[0];
    if (av.kind === 'image') return toImageSrc(av.value);
    if (av.kind === 'model') {
      const idx = modelUrls.findIndex((u)=>u===av.value);
      const n = ((idx >= 0 ? idx : 0) % 6) + 1; // choose a consistent local thumbnail
      return `/avatars/avatar${n}.jpg`;
    }
    return avatarGallery[0];
  };
  const avatarForUserId = (uid: string): string => {
    if (uid === userIdRef.current) return imageForAvatar(authedUser?.avatar) || avatarGallery[0];
    const m = roster.find(r => r.id === uid);
    return imageForAvatar(m?.avatar) || avatarGallery[0];
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const buildSummary = (fullTranscript: string, chatArr: Array<{userId:string; name:string; text:string; ts:number}>) => {
    const txt = (fullTranscript || '').trim();
    const chatText = (chatArr || []).map(m=>`${m.name}: ${m.text}`).join(' ');
    const all = `${txt} ${chatText}`.trim();
    if (!all) return ["No transcript captured."];
    const sents = all.split(/(?<=\.|\?|!)\s+/).map(s=>s.trim()).filter(Boolean);
    const stop = new Set(["the","is","a","an","and","or","to","of","in","on","for","with","that","this","it","as","at","by","be","we","you","they","i","are","was","were","from","our","your","their","will","can","should","could","would","about","into","over","after","before","than","then","so","if","but","not","no","yes","do","does","did"]);
    const freq: Record<string, number> = {};
    for (const w of all.toLowerCase().match(/\b[\p{L}0-9']+\b/gu) || []) { if (!stop.has(w) && w.length>2) freq[w]=(freq[w]||0)+1; }
    const scoreSent = (s: string) => { let sc=0; for (const w of s.toLowerCase().match(/\b[\p{L}0-9']+\b/gu) || []) { if (freq[w]) sc+=freq[w]; } return sc; };
    const scored = sents.map((s,i)=>({i,s,sc:scoreSent(s)})).sort((a,b)=>b.sc-a.sc).slice(0,8).sort((a,b)=>a.i-b.i).map(o=>o.s);
    const lowerAll = all.toLowerCase();
    const acts: string[] = [];
    for (const line of (txt+"\n"+chatText).split(/\n|\.|\?|!/)) {
      const l=line.trim(); if(!l) continue;
      if (/\b(will|todo|to do|next|follow up|assign|ownership|deadline|deliver|prepare|send|share)\b/i.test(l)) acts.push(l);
    }
    const decs: string[] = [];
    for (const line of (txt+"\n"+chatText).split(/\n|\.|\?|!/)) {
      const l=line.trim(); if(!l) continue;
      if (/\b(decide|decided|agree|agreed|approved|choose|chose|select|selected)\b/i.test(l)) decs.push(l);
    }
    const out: string[] = [];
    if (scored.length) out.push(`Overview: ${scored.slice(0,3).join(' ')}`);
    if (scored.length>3) { for (const s of scored.slice(3)) out.push(`Key: ${s}`); }
    if (decs.length) { out.push('Decisions:'); for (const d of decs.slice(0,6)) out.push(`- ${d}`); }
    if (acts.length) { out.push('Action items:'); for (const a of acts.slice(0,8)) out.push(`- ${a}`); }
    return out.length ? out : ["No notable content detected."];
  };

  const lastMeetingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let recognition: any = null;
    let stopRequested = false;
    let lastResultTs = Date.now();
    const SpeechRecognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setSttAvailable(false); setSttStatus('unsupported'); return; }
    if (!joined || meetingEnded) { setSttStatus('not_joined'); return; }
    if (sttManualStopRef.current) { setSttStatus('stopped'); return; }
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    try { recognition.maxAlternatives = 1; } catch {}
    recognition.onstart = () => { try { setSttStatus('running'); console.log('SpeechRecognition started'); } catch {} };
    let recent = '';
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const txt = (res[0]?.transcript || '').trim();
          if (txt) {
            transcriptRef.current = ((transcriptRef.current || '') + ' ' + txt).trim();
            recent = (recent + ' ' + txt).trim();
            try { socketRef.current?.emit('stt:segment', { text: txt }); } catch {}
          }
        } else {
          interim += res[0]?.transcript || '';
        }
      }
      lastResultTs = Date.now();
      const display = ((transcriptRef.current || '') + (interim ? (' ' + interim.trim()) : '')).trim();
      setTranscript(display);
    };
    recognition.onspeechstart = () => { try { console.log('SpeechRecognition speechstart'); } catch {} };
    recognition.onspeechend = () => { try { console.log('SpeechRecognition speechend'); } catch {} };
    recognition.onerror = (e: any) => {
      const name = (e?.error || '').toString();
      try { console.warn('SpeechRecognition error:', name); } catch {}
      // Do not spin if user explicitly blocked
      if (name.includes('not-allowed') || name.includes('service-not-allowed')) return;
      if (!stopRequested && !sttManualStopRef.current) setTimeout(() => { try { recognition.start(); } catch {} }, 1200);
    };
    recognition.onaudioend = () => { if (!stopRequested && !sttManualStopRef.current) { try { recognition.start(); } catch {} } };
    recognition.onsoundend = () => { if (!stopRequested && !sttManualStopRef.current) { try { recognition.start(); } catch {} } };
    recognition.onend = () => {
      try { console.log('SpeechRecognition ended, restarting'); } catch {}
      if (!stopRequested && !sttManualStopRef.current) try { recognition.start(); } catch {}
    };
    // Request mic permission before starting SR to avoid silent failures
    (async () => {
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
      try { recognition.start(); setSttStatus('running'); } catch {}
    })();
    recognitionRef.current = recognition;
    const watchdog = setInterval(() => {
      if (stopRequested) return;
      const idleFor = Date.now() - lastResultTs;
      if (idleFor > 12000) {
        try { console.log('SpeechRecognition idle >12s, restarting'); } catch {}
        try { recognition.stop(); } catch {}
        try { recognition.start(); } catch {}
        lastResultTs = Date.now();
      }
    }, 6000);
    const summarizer = setInterval(() => {
      if (!recent) return;
      const text = recent.trim();
      const words = text.split(/\s+/);
      const last = words.slice(-40).join(' ');
      const summary = last.length > 0 ? `Recent: ${last}` : '';
      if (summary) setSummaries((prev) => [...prev, summary].slice(-20));
      recent = '';
    }, 10000);
    return () => {
      stopRequested = true;
      clearInterval(summarizer);
      clearInterval(watchdog);
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
      if (!sttManualStopRef.current && joined && !meetingEnded && sttAvailable) setSttStatus('idle');
    };
  }, [joined, meetingEnded, sttAvailable]);

  // Keep STT status in sync with session/support changes
  useEffect(() => {
    if (!sttAvailable) { setSttStatus('unsupported'); return; }
    if (!joined || meetingEnded) { setSttStatus('not_joined'); return; }
    if (sttManualStopRef.current) { setSttStatus('stopped'); return; }
    if (!recognitionRef.current) { setSttStatus('idle'); return; }
  }, [joined, meetingEnded, sttAvailable]);

  const loadMeetings = () => {
    try {
      const raw = localStorage.getItem('meetings') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setMeetings(arr);
    } catch {}
  };

  const saveMeeting = (payload: { summary?: string[]; transcript: string; whiteboardImage?: string }) => {
    const participants = [{ id: userIdRef.current, name: authedUser?.name || displayName }, ...roster.map(r=>({ id: r.id, name: r.name }))]
      .filter((v,i,a)=> a.findIndex(x=>x.id===v.id)===i);
    const finalSummary = (payload.summary && payload.summary.length)
      ? payload.summary
      : buildSummary(payload.transcript || '', chatLog);
    const meeting = {
      id: `m_${Date.now()}`,
      roomId,
      ts: Date.now(),
      title: `Room ${roomId || ''} — ${new Date().toLocaleString()}`.trim(),
      summary: finalSummary,
      transcript: payload.transcript,
      participants,
      whiteboardImage: payload.whiteboardImage,
      chat: chatLog.slice(-500)
    };
    lastMeetingIdRef.current = meeting.id;
    try {
      const raw = localStorage.getItem('meetings') || '[]';
      const arr = JSON.parse(raw);
      const next = Array.isArray(arr) ? [...arr, meeting] : [meeting];
      localStorage.setItem('meetings', JSON.stringify(next));
      setMeetings(next);
    } catch {
      localStorage.setItem('meetings', JSON.stringify([meeting]));
      setMeetings([meeting]);
    }
    return meeting.id;
  };

  // Render remote avatars in the scene
  useEffect(() => {
    // This effect taps into the three scene by creating/looking up a marker object attached to mountRef
    if (!mountRef.current) return;
    const container = mountRef.current;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    // @ts-ignore - retrieve renderer from canvas
    const renderer: THREE.WebGLRenderer | undefined = (canvas as any).__threeRenderer;
    // We didn't store it earlier, so we attach a hidden property when creating it. Let's ensure we do that in init.
  }, []);

  const maybeStartPeer = async (peerId: string) => {
    if (peerConnsRef.current[peerId]) return;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }
      ]
    });
    peerConnsRef.current[peerId] = pc;
    // Ensure senders exist up-front so replaceTrack works later even if local tracks attach after
    try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch {}
    try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch {}
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit("webrtc:signal", { to: peerId, from: userIdRef.current, data: pc.localDescription });
        }
      } catch {}
    };
       
    
    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (!e.candidate) return;
      socketRef.current?.emit("webrtc:signal", { to: peerId, from: userIdRef.current, data: e.candidate });
    };
    pc.ontrack = (e: RTCTrackEvent) => {
      if (!e.streams[0]) return;
      remoteStreamsRef.current[peerId] = e.streams[0];
      forceRerender((prev: number) => prev + 1);
      try {
        let audioEl = remoteAudioElsRef.current[peerId];
        if (!audioEl) { audioEl = new Audio(); remoteAudioElsRef.current[peerId] = audioEl; }
        audioEl.autoplay = true; (audioEl as any).playsInline = true;
        if (audioEl.srcObject !== e.streams[0]) audioEl.srcObject = e.streams[0];
        audioEl.volume = 1.0; audioEl.muted = false;
        audioEl.play().catch(()=>{});
      } catch {}
    };
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, mediaStreamRef.current as MediaStream));
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("webrtc:signal", { to: peerId, from: userIdRef.current, data: pc.localDescription });
  };

  const teardownPeer = (peerId: string) => {
    const pc = peerConnsRef.current[peerId];
    if (!pc) return;
    pc.close();
    delete peerConnsRef.current[peerId];
    delete remoteStreamsRef.current[peerId];
    const a = remoteAudioElsRef.current[peerId];
    if (a) { try { a.srcObject = null as any; a.remove(); } catch {} delete remoteAudioElsRef.current[peerId]; }
    forceRerender((prev: number) => prev + 1);
  };

  const ensurePeer = async (peerId: string) => {
    if (peerConnsRef.current[peerId]) return peerConnsRef.current[peerId];
    await maybeStartPeer(peerId);
    return peerConnsRef.current[peerId];
  };

  const resumeAllRemoteAudio = async () => {
    try { if (audioCtxRef.current && audioCtxRef.current.state !== 'running') await audioCtxRef.current.resume(); } catch {}
    try {
      const els = Object.values(remoteAudioElsRef.current);
      for (const a of els) { try { await a.play(); } catch {} }
    } catch {}
  };

  // Media helpers used by Settings toggles
  const ensureMediaIfNeeded = async () => {
    if (mediaStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch {}
      }
      // Attempt to resume context on a user gesture
      try { if (audioCtxRef.current && audioCtxRef.current.state !== 'running') await audioCtxRef.current.resume(); } catch {}
      // Local mic monitor (echo to user when mic enabled)
      try {
        if (audioCtxRef.current && stream.getAudioTracks()[0]) {
          const src = audioCtxRef.current.createMediaStreamSource(stream);
          const gain = audioCtxRef.current.createGain();
          gain.gain.value = 0.0; // start muted until toggled on
          src.connect(gain).connect(audioCtxRef.current.destination);
          micMonitorRef.current = { source: src, gain };
          // Create analyser for mic level meter
          const analyser = audioCtxRef.current.createAnalyser();
          analyser.fftSize = 256;
          micAnalyserRef.current = analyser;
          try { src.connect(analyser); } catch {}
          // start update loop (will show ~0 until mic unmuted)
          const data = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            try { analyser.getByteTimeDomainData(data); } catch {}
            // RMS of waveform
            let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v*v; }
            const rms = Math.sqrt(sum / data.length);
            setMicLevel(Math.min(1, rms * 2));
            if (rms > 0.015) lastVoiceTsRef.current = Date.now();
            micLevelRafRef.current = requestAnimationFrame(loop);
          };
          micLevelRafRef.current = requestAnimationFrame(loop);
        }
      } catch {
        // If WebAudio fails, continue without local monitor
        micMonitorRef.current = null;
      }
    } catch (e) {
      // Quietly ignore here; we will retry later on user action
      setErrorMsg(null);
    }
  };

  const replaceAudioTrackForAll = async (track: MediaStreamTrack | null) => {
    const conns = peerConnsRef.current;
    for (const pid of Object.keys(conns)) {
      const pc = conns[pid];
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
      if (sender) {
        try { await sender.replaceTrack(track as any); } catch {}
      }
    }
    // Renegotiate so remote peers update transceivers properly
    try {
      for (const pid of Object.keys(conns)) {
        const pc = conns[pid];
        if (pc.signalingState === 'stable') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('webrtc:signal', { to: pid, from: userIdRef.current, data: pc.localDescription });
        }
      }
    } catch {}
  };

  const replaceVideoTrackForAll = async (track: MediaStreamTrack | null) => {
    const conns = peerConnsRef.current;
    for (const pid of Object.keys(conns)) {
      const pc = conns[pid];
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        try { await sender.replaceTrack(track as any); } catch {}
      }
    }
    // Renegotiate so video removal/addition is reflected remotely
    try {
      for (const pid of Object.keys(conns)) {
        const pc = conns[pid];
        if (pc.signalingState === 'stable') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('webrtc:signal', { to: pid, from: userIdRef.current, data: pc.localDescription });
        }
      }
    } catch {}
  };

  // Whiteboard functions (component scope)
  const setupWhiteboardCanvas = () => {
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    wbCtxRef.current = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const clearWhiteboardCanvas = () => {
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const ctx = wbCtxRef.current || canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const drawStrokeOnCanvas = (s: { color: string; size: number; points: Array<[number, number]>; tool?: string; }) => {
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const ctx = wbCtxRef.current || canvas.getContext('2d');
    if (!ctx || s.points.length === 0) return;
    const tool = s.tool || 'pencil';
    if (tool === 'airbrush') {
      const density = 12;
      ctx.fillStyle = s.color;
      for (const [x,y] of s.points) {
        for (let i=0;i<density;i++) {
          const r = s.size * (Math.random()*0.5);
          const ang = Math.random()*Math.PI*2;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(x + Math.cos(ang)*r, y + Math.sin(ang)*r, 1.2, 0, Math.PI*2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
      return;
    }
    // Use composite erase for precise erasing at cursor location
    const isEraser = tool === 'eraser';
    if (isEraser) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = s.size;
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = tool==='brush' || tool==='marker' ? Math.max(6, s.size) : s.size;
    }
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0, y0);
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = s.points[i];
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (isEraser) {
      ctx.restore();
    }
  };

  const pointerToCanvasXY = (canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return [x, y];
  };

  const handleWbPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (meetingEnded) return;
    const canvas = wbCanvasRef.current; if (!canvas) return;
    if (wbToolRef.current === 'fill') {
      const [x,y] = pointerToCanvasXY(canvas, e.clientX, e.clientY);
      floodFillAt(Math.floor(x), Math.floor(y), wbColor);
      socketRef.current?.emit('whiteboard:fill', { color: wbColor, x: Math.floor(x), y: Math.floor(y) });
      return;
    }
    wbDrawingRef.current = true; wbPointsRef.current = [];
    const [x, y] = pointerToCanvasXY(canvas, e.clientX, e.clientY);
    wbPointsRef.current.push([x, y]);
  };
  const handleWbPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (meetingEnded) return;
    if (!wbDrawingRef.current) return;
    const canvas = wbCanvasRef.current; if (!canvas) return;
    const [x, y] = pointerToCanvasXY(canvas, e.clientX, e.clientY);
    const last = wbPointsRef.current[wbPointsRef.current.length - 1];
    wbPointsRef.current.push([x, y]);
    const seg = { color: wbColor, size: wbSize, points: [last, [x, y]] as any, tool: wbToolRef.current };
    drawStrokeOnCanvas(seg);
    const now = performance.now();
    if (now - wbLastEmitRef.current > 30) {
      wbLastEmitRef.current = now;
      socketRef.current?.emit('whiteboard:stroke', seg);
    }
  };
  const handleWbPointerUp = () => {
    if (meetingEnded) return;
    if (!wbDrawingRef.current) return;
    wbDrawingRef.current = false;
    const pts = wbPointsRef.current.slice();
    wbPointsRef.current = [];
    if (pts.length > 1) {
      socketRef.current?.emit('whiteboard:stroke', { color: wbColor, size: wbSize, points: pts, tool: wbToolRef.current });
    } else if (pts.length === 1) {
      // Emit a tiny dot to reflect a click without movement
      const p = pts[0];
      socketRef.current?.emit('whiteboard:stroke', { color: wbColor, size: wbSize, points: [p, [p[0]+0.01, p[1]+0.01]], tool: wbToolRef.current });
    }
  };
  const handleWbTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (meetingEnded) return;
    const t = e.touches[0]; if (!t) return; e.preventDefault();
    const canvas = wbCanvasRef.current; if (!canvas) return;
    if (wbToolRef.current === 'fill') {
      const [x,y] = pointerToCanvasXY(canvas, t.clientX, t.clientY);
      floodFillAt(Math.floor(x), Math.floor(y), wbColor);
      socketRef.current?.emit('whiteboard:fill', { color: wbColor, x: Math.floor(x), y: Math.floor(y) });
      return;
    }
    wbDrawingRef.current = true; wbPointsRef.current = [];
    const [x, y] = pointerToCanvasXY(canvas, t.clientX, t.clientY);
    wbPointsRef.current.push([x, y]);
  };
  const handleWbTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (meetingEnded) return;
    const t = e.touches[0]; if (!t || !wbDrawingRef.current) return; e.preventDefault();
    const canvas = wbCanvasRef.current; if (!canvas) return;
    const [x, y] = pointerToCanvasXY(canvas, t.clientX, t.clientY);
    const last = wbPointsRef.current[wbPointsRef.current.length - 1];
    wbPointsRef.current.push([x, y]);
    const seg = { color: wbColor, size: wbSize, points: [last, [x, y]] as any, tool: wbToolRef.current };
    drawStrokeOnCanvas(seg);
    const now = performance.now();
    if (now - wbLastEmitRef.current > 30) {
      wbLastEmitRef.current = now;
      socketRef.current?.emit('whiteboard:stroke', seg);
    }
  };

  const floodFillAt = (sx: number, sy: number, colorHex: string) => {
    const canvas = wbCanvasRef.current; if (!canvas) return;
    const ctx = wbCtxRef.current || canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const img = ctx.getImageData(0, 0, rect.width, rect.height);
    const data = img.data; const w = img.width, h = img.height;
    const idx = (x:number,y:number)=> (y*w + x)*4;
    const target = idx(sx, sy);
    const r0=data[target], g0=data[target+1], b0=data[target+2], a0=data[target+3];
    const hexToRgb = (hex:string)=>{ const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!; return {r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}; };
    const {r, g, b} = hexToRgb(colorHex);
    if (r0===r && g0===g && b0===b) return;
    const q: Array<[number,number]> = [[sx,sy]];
    while(q.length){
      const [x,y]=q.pop()!; const i=idx(x,y);
      if (x<0||y<0||x>=w||y>=h) continue;
      if (data[i]===r && data[i+1]===g && data[i+2]===b) continue;
      if (data[i]!==r0 || data[i+1]!==g0 || data[i+2]!==b0 || data[i+3]!==a0) continue;
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
      q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(img, 0, 0);
  };


  return (
    <div className="min-h-screen flex flex-col text-[#F1F1F1]">
      {/* Fixed background layer */}
      <div className="fixed inset-0 -z-10">
        <img src="/room.jpg" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      {joined && (
        <div className="fixed inset-0 -z-10">
          <img src="/joinmeet.jpg" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#3D2C8D]/30 to-black/80" />
          <div className="absolute -top-20 left-10 h-48 w-48 bg-[#7A00FF]/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 h-64 w-64 bg-[#C63D5A]/20 rounded-full blur-3xl animate-ping" />
        </div>
      )}
      {/* Lobby: shown after login/onboarding but before join */}
      {sessionReady && !onboardingOpen && !joined && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img src="/joinmeet.jpg" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#3D2C8D]/30 to-black/85" />
            <div className="absolute -top-14 left-14 h-40 w-40 bg-[#7A00FF]/40 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 h-56 w-56 bg-[#C63D5A]/30 rounded-full blur-3xl animate-ping" />
          </div>
          <div className="relative w-full max-w-lg mx-auto px-4">
            <div className="rounded-2xl shadow-2xl backdrop-blur-xl bg-white/10 border border-white/20 overflow-hidden">
              <div className="card-body">
                <h3 className="text-xl font-semibold text-white text-center tracking-wide">Start or Join a Room</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button className="rounded-lg px-4 py-3 bg-gradient-to-r from-[#3D2C8D] to-[#7A00FF] hover:brightness-110 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={() => {
                    const code = ('R' + Math.random().toString(36).slice(2,8)).toUpperCase();
                    setCreatedCode(code);
                    setLobbyMode('created');
                  }}>Create Room</button>
                  <button className="rounded-lg px-4 py-3 bg-white/10 hover:bg-white/20 text-white shadow transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={() => setLobbyMode('use')}>Use a Code</button>
                </div>
                {lobbyMode === 'created' && (
                  <div className="mt-4 p-4 rounded-xl bg-white/10 border border-white/20 text-center">
                    <div className="text-sm text-white/80">Your Room Code</div>
                    <div className="text-2xl font-mono text-white mt-1 tracking-wider">{createdCode}</div>
                    <div className="mt-3 flex justify-center">
                      <button className="rounded-full px-6 py-2 bg-gradient-to-r from-[#3D2C8D] to-[#7A00FF] hover:brightness-110 text-white shadow-lg" onClick={() => {
                        setRoomCodeInput(createdCode);
                        setRoomId(createdCode);
                        setJoined(true);
                        sessionStorage.setItem('lastRoomId', createdCode);
                        sessionStorage.setItem('joined','1');
                      }}>Join</button>
                    </div>
                  </div>
                )}
                {lobbyMode === 'use' && (
                  <div className="mt-4 p-4 rounded-xl bg-white/10 border border-white/20">
                    <label className="text-sm text-white/80">Enter Room Code</label>
                    <div className="mt-2 flex gap-2">
                      <input className="flex-1 rounded-md px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-[#7A00FF]" value={roomCodeInput} onChange={(e)=>setRoomCodeInput(e.target.value.toUpperCase())} placeholder="e.g., RABC123" />
                      <button className="rounded-md px-5 py-2 bg-gradient-to-r from-[#3D2C8D] to-[#7A00FF] hover:brightness-110 text-white shadow-lg" onClick={() => {
                        if (!roomCodeInput) return;
                        setRoomId(roomCodeInput);
                        setJoined(true);
                        sessionStorage.setItem('lastRoomId', roomCodeInput);
                        sessionStorage.setItem('joined','1');
                      }}>Join</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-white/10 bg-white/10 backdrop-blur-md relative">
        <div className="container-page h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {joined && (
              <button className="h-8 w-8 grid place-items-center rounded-md bg-white/10 text-white hover:bg-white/20" onClick={() => setMenuOpen((v)=>!v)} aria-label="Menu">
                <span className="text-xl">≡</span>
              </button>
            )}
            <div className="h-8 w-8 rounded-lg bg-white/90 shadow-sm" />
            <span className="font-semibold tracking-wide text-white">Metaverse Collaboration</span>
            {roomId && (
              <span className="ml-2 flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-[#3D2C8D] text-white">Room: {roomId}</span>
                <button
                  className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  onClick={async()=>{ try { await navigator.clipboard.writeText(roomId); } catch {} }}
                >Copy Code</button>
              </span>
            )}
          </div>
          {!joined ? (
            <div className="flex items-center gap-2">
              <input className="input w-44 bg-[#1E1E1E] text-[#F1F1F1] placeholder:text-[#A0A0A0] border border-[#2A2A2A]" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <input className="input w-44 bg-[#1E1E1E] text-[#F1F1F1] placeholder:text-[#A0A0A0] border border-[#2A2A2A]" placeholder="Room code" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value)} />
              <button className="btn-secondary hover:brightness-110 bg-[#2A2A2A] text-white" onClick={() => {
                const user = authedUser || { id: userIdRef.current, name: displayName || `Guest-${Math.floor(Math.random()*1000)}`, email: 'guest@local', avatar: { kind: 'image' as const, value: avatarImage } };
                user.name = displayName || user.name;
                setAuthedUser(user);
                try { localStorage.setItem('authUser', JSON.stringify(user)); } catch {}
              }}>Set Name</button>
              <button className="btn-secondary hover:brightness-110 bg-[#3D2C8D] hover:bg-[#7A00FF] text-white" onClick={() => { const code = roomCodeInput.trim(); if (code) { setRoomId(code); sessionStorage.setItem('lastRoomId', code); } }}>Use Code</button>
              <button className="btn-secondary hover:brightness-110 bg-[#3D2C8D] hover:bg-[#7A00FF] text-white" onClick={() => { const code = "room-" + Math.random().toString(36).slice(2, 8); setRoomId(code); setRoomCodeInput(code); sessionStorage.setItem('lastRoomId', code); }}>Create Room</button>
              <button className="btn-secondary hover:brightness-110 bg-[#3D2C8D] hover:bg-[#7A00FF] text-white" onClick={() => { loadMeetings(); setDashboardOpen(true); }}>Dashboard</button>
              <button className="btn-primary shadow-sm hover:shadow-md bg-[#3D2C8D] hover:bg-[#7A00FF] text-white" onClick={async () => {
                setErrorMsg(null);
                try {
                  let code = roomId || roomCodeInput.trim();
                  if (!code) { code = "room-" + Math.random().toString(36).slice(2, 8); setRoomId(code); setRoomCodeInput(code); sessionStorage.setItem('lastRoomId', code); }
                  let user = authedUser;
                  if (!user) { user = { id: userIdRef.current, name: displayName || `Guest-${Math.floor(Math.random()*1000)}`, email: "guest@local", avatar: { kind: 'image' as const, value: avatarImage } }; setAuthedUser(user); sessionStorage.setItem('sessionAuthed', '1'); }
                  if (!joined) {
                    let stream: MediaStream | null = null;
                    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); setMicEnabled(true); setCamEnabled(true); }
                    catch { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); setMicEnabled(true); setCamEnabled(false); } catch { stream = null; setMicEnabled(false); setCamEnabled(false); } }
                    mediaStreamRef.current = stream;
                    if (videoRef.current && stream) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
                    nameRef.current = displayName; setMeetingEnded(false); setJoined(true); sessionStorage.setItem('joined', '1');
                    const selected = (user?.avatar?.value) || avatarImage; const url = modelUrlForAvatar(selected);
                    const { group: obj, clips } = await loadModel(url); obj.traverse((o) => { (o as any).castShadow = true; }); localAvatarRef.current = obj; const scene = sceneRef.current; if (scene) scene.add(obj);
                    baseRotXRef.current = obj.rotation.x || 0; if (clips && clips.length) { localMixerRef.current = new THREE.AnimationMixer(obj); const idle = clips[0]; const walk = clips[1]; const idleAct = localMixerRef.current.clipAction(idle); idleAct.play(); const walkAct = walk ? localMixerRef.current.clipAction(walk) : undefined; localActionsRef.current = { idle: idleAct, walk: walkAct, current: 'idle' }; }
                    setTimeout(() => { resumeAllRemoteAudio(); }, 300);
                  }
                } catch (err: any) { setErrorMsg(null); }
              }} disabled={joined}>{joined ? "Joined" : "Join"}</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button className="ml-3 rounded-md px-4 py-2 bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={async () => {
                setMeetingEnded(true);
                const full = (transcriptRef.current || transcript || '').trim();
                const bullets = buildSummary(full, chatLog);
                setSummaries(bullets);
                const whiteboardImage = (() => { const c = wbCanvasRef.current; try { return c ? c.toDataURL('image/png') : undefined; } catch { return undefined; } })();
                try { recognitionRef.current?.stop?.(); } catch {}
                if (mediaStreamRef.current) { try { mediaStreamRef.current.getTracks().forEach(t=>{ try { t.stop(); } catch {} }); } catch {} }
                saveMeeting({ transcript: transcriptRef.current || transcript || '', summary: bullets, whiteboardImage });
                try { socketRef.current?.emit('meeting:end'); } catch {}
              }}>{`End Meeting (${timerText})`}</button>
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <img src={avatarForUserId(userIdRef.current)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-7 w-7 rounded-full object-cover" />
                <span className="text-white text-sm font-medium">{authedUser?.name || displayName || 'You'}</span>
              </div>
            </div>
          )}
        </div>
        {joined && menuOpen && (
          <div className="absolute left-4 top-14 z-20 w-56 rounded-md border border-white/20 bg-[#1E1E1E] text-[#F1F1F1] shadow-xl">
            <button className="w-full text-left px-3 py-2 hover:bg-white/10" onClick={() => { loadMeetings(); setDashboardOpen(true); setMenuOpen(false); }}>Dashboard</button>
            <a className="block px-3 py-2 hover:bg-white/10" href="#media-access" onClick={() => setMenuOpen(false)}>Media Access</a>
            <button className="w-full text-left px-3 py-2 hover:bg-white/10" onClick={() => { setWbOpen((v)=>!v); setMenuOpen(false); }}>{wbOpen ? 'Hide Whiteboard' : 'Show Whiteboard'}</button>
            <button className="w-full text-left px-3 py-2 hover:bg-white/10" onClick={() => { sessionStorage.removeItem('sessionAuthed'); setSessionReady(false); setJoined(false); setMenuOpen(false); }}>Logout</button>
          </div>
        )}
      </header>

      <main className={`flex-1 grid grid-cols-12 gap-4 container-page py-4 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>

        {/* Left sidebar: Participants list, Videos + controls, Media Access */}
        <aside className="col-span-12 md:col-span-3">
          <div className="card shadow-sm bg-black/40 backdrop-blur-sm border border-white/10 transition-all duration-300">
            <div className="card-body">
              <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Participants</h3>
              {roster.length === 0 ? (
                <p className="text-sm text-[#A0A0A0]">No participants yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {[{ id: userIdRef.current, name: authedUser?.name || displayName, avatar: authedUser?.avatar },
                    ...roster.filter((m)=> m.id !== userIdRef.current)
                   ].map((m) => (
                    <li key={m.id} className="flex items-center gap-2 bg-black/50 px-2 py-1 rounded border border-white/10">
                      <img src={avatarForUserId(m.id)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-5 w-5 rounded-full object-cover" />
                      {m.id===userIdRef.current ? `You: ${m.name}` : m.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-4 card shadow-sm bg-black/40 backdrop-blur-sm border border-white/10 transition-all duration-300">
            <div className="card-body">
              <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Participants Video</h3>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <button
                    className={`w-full rounded-full px-4 py-2 font-semibold btn-primary from-[#3D2C8D] to-[#7A00FF] bg-gradient-to-r disabled:opacity-60 disabled:cursor-not-allowed`}
                    disabled={meetingEnded || micBusy}
                    onClick={async () => {
                      if (meetingEnded || micBusy) return;
                      setMicBusy(true);
                      try {
                        await ensureMediaIfNeeded();
                        let st = mediaStreamRef.current;
                        if (!st) { try { st = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaStreamRef.current = st; } catch { setErrorMsg(null); return; } }
                        let a = st.getAudioTracks()[0];
                        if (!a) { try { const anew = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks()[0]; st.addTrack(anew); a = anew; } catch { setErrorMsg(null); return; } }
                        if (a.enabled) { await replaceAudioTrackForAll(null); a.enabled = false; if (micMonitorRef.current) micMonitorRef.current.gain.gain.value = 0.0; if (micLevelRafRef.current) { cancelAnimationFrame(micLevelRafRef.current); micLevelRafRef.current = null; } setMicLevel(0); lastVoiceTsRef.current = 0; setMicEnabled(false); }
                        else {
                          if (a.readyState === 'ended') { try { const anew = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks()[0]; st.addTrack(anew); await replaceAudioTrackForAll(anew); a = anew; } catch { setErrorMsg(null); return; } }
                          else { await replaceAudioTrackForAll(a); }
                          a.enabled = true;
                          try {
                            if (!audioCtxRef.current || (audioCtxRef.current as any).state === 'closed') { audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); }
                            if (audioCtxRef.current.state !== 'running') await audioCtxRef.current.resume();
                            if (!micMonitorRef.current) { try { const src = audioCtxRef.current.createMediaStreamSource(st); const gain = audioCtxRef.current.createGain(); gain.gain.value = 0.0; src.connect(gain).connect(audioCtxRef.current.destination); micMonitorRef.current = { source: src, gain }; } catch {} }
                            if (!micAnalyserRef.current) { try { const analyser = audioCtxRef.current.createAnalyser(); analyser.fftSize = 256; micAnalyserRef.current = analyser; micMonitorRef.current?.source.connect(analyser); } catch {} }
                            if (!micLevelRafRef.current && micAnalyserRef.current) { const analyser = micAnalyserRef.current; const data = new Uint8Array(analyser.frequencyBinCount); const loop = () => { try { analyser.getByteTimeDomainData(data); } catch {} let sum = 0; for (let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum += v*v;} const rms=Math.sqrt(sum/data.length); setMicLevel(Math.min(1,rms*2)); micLevelRafRef.current = requestAnimationFrame(loop); }; micLevelRafRef.current = requestAnimationFrame(loop); }
                          } catch {}
                          if (micMonitorRef.current) micMonitorRef.current.gain.gain.value = 1.0;
                          setMicEnabled(true);
                          resumeAllRemoteAudio();
                        }
                      } finally { setMicBusy(false); }
                    }}
                  >{micEnabled ? 'Mute Mic' : 'Unmute Mic'}</button>
                  <button
                    className={`w-full rounded-full px-4 py-2 font-semibold btn-primary disabled:opacity-60 disabled:cursor-not-allowed`}
                    disabled={meetingEnded || camBusy}
                    onClick={async () => {
                      if (meetingEnded || camBusy) return;
                      setCamBusy(true);
                      try {
                        await ensureMediaIfNeeded();
                        let st = mediaStreamRef.current;
                        if (!st) { try { st = await navigator.mediaDevices.getUserMedia({ video: true }); mediaStreamRef.current = st; } catch { setErrorMsg(null); return; } }
                        let vtrack = st.getVideoTracks()[0];
                        if (camEnabled && vtrack) { await replaceVideoTrackForAll(null); vtrack.stop(); st.removeTrack(vtrack); setCamEnabled(false); if (videoRef.current) videoRef.current.srcObject = st; }
                        else if (!camEnabled) {
                          try {
                            if (!vtrack || vtrack.readyState === 'ended') { const v = await navigator.mediaDevices.getUserMedia({ video: true }); const newTrack = v.getVideoTracks()[0]; st.addTrack(newTrack); await replaceVideoTrackForAll(newTrack); }
                            else { await replaceVideoTrackForAll(vtrack); }
                            if (videoRef.current) videoRef.current.srcObject = st; setCamEnabled(true); resumeAllRemoteAudio();
                          } catch { setErrorMsg(null); }
                        }
                      } finally { setCamBusy(false); }
                    }}
                  >{camEnabled ? 'Turn Camera Off' : 'Turn Camera On'}</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  {!meetingEnded && camEnabled && mediaStreamRef.current && (
                    <div className="relative">
                      <video className="w-full aspect-video rounded-lg bg-black" muted playsInline autoPlay ref={(el: HTMLVideoElement | null) => { if (el && el.srcObject !== mediaStreamRef.current) el.srcObject = mediaStreamRef.current; }} />
                      <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                        <img src={avatarForUserId(userIdRef.current)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-4 w-4 rounded-full object-cover" />
                        <span>{authedUser?.name || displayName || 'You'}</span>
                      </div>
                      <div className="absolute top-1 right-1 text-[12px] px-1.5 py-0.5 rounded bg-black/60 text-white">{micEnabled ? '🎤' : '🔇'}</div>
                    </div>
                  )}
                  {!meetingEnded && (Object.entries(remoteStreamsRef.current) as [string, MediaStream][]).map(([peerId, stream]) => {
                    const vids = stream.getVideoTracks();
                    const hasVideo = vids && vids.length>0 && vids[0].readyState==='live';
                    return (
                      <div key={peerId} className="relative">
                        {hasVideo ? (
                          <video className="w-full aspect-video rounded-lg bg-black" autoPlay playsInline ref={(el: HTMLVideoElement | null) => { if (el && el.srcObject !== stream) el.srcObject = stream; try { (el as any).muted = false; } catch {} }} />
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-black grid place-items-center">
                            <img src={avatarForUserId(peerId)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-16 w-16 rounded-full object-cover" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                          <img src={avatarForUserId(peerId)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-4 w-4 rounded-full object-cover" />
                          <span>{nameForUserId(peerId)}</span>
                        </div>
                        <div className="absolute top-1 right-1 text-[12px] px-1.5 py-0.5 rounded bg-black/60 text-white">{(() => { const a = stream.getAudioTracks(); const live = a && a.length>0 && a[0].enabled && a[0].readyState==='live'; return live ? '🎤' : '🔇'; })()}</div>
                      </div>
                    );
                  })}
                  {meetingEnded && (
                    <div className="col-span-2 text-center text-sm text-[#A0A0A0] py-6 bg-[#121212] rounded-md border border-[#2A2A2A]">Meeting ended</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div id="media-access" className="mt-4 card shadow-sm bg-black/40 backdrop-blur-sm border border-white/10 transition-all duration-300">
            <div className="card-body">
              <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Media Access</h3>
              <input type="file" multiple accept="image/*,application/pdf" className="mt-2 text-sm" onChange={(e)=>{
                const files = Array.from(e.target.files || []);
                const items: Array<{name:string;url:string;type:string}> = [];
                const toBroadcast: Array<{name:string;type:string;dataUrl:string}> = [];
                const readers: Promise<void>[] = [];
                for (const f of files) {
                  const url = URL.createObjectURL(f);
                  items.push({ name: f.name, url, type: f.type });
                  const p = new Promise<void>((resolve)=>{
                    const r = new FileReader();
                    r.onload = () => { toBroadcast.push({ name: f.name, type: f.type, dataUrl: (r.result as string) || '' }); resolve(); };
                    r.onerror = () => resolve();
                    r.readAsDataURL(f);
                  });
                  readers.push(p);
                }
                setMediaItems(prev => [...prev, ...items]);
                Promise.all(readers).then(()=>{
                  if (toBroadcast.length > 0) socketRef.current?.emit('media:add', { items: toBroadcast });
                });
              }} />
              {mediaItems.length>0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {mediaItems.map((m,i)=> (
                    <a key={i} href={m.url} target="_blank" className="block border border-[#2A2A2A] rounded overflow-hidden bg-[#111111]">
                      {m.type.startsWith('image/') ? (
                        <img src={m.url} className="w-full h-24 object-cover" />
                      ) : (
                        <div className="h-24 w-full grid place-items-center text-xs text-[#A0A0A0]">{m.name}</div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          {errorMsg && (<p className="text-sm text-red-600 mt-1">{errorMsg}</p>)}
        </aside>

        {/* Center: Avatar scene + Whiteboard */}
        <section className="col-span-12 md:col-span-6">
          <div className="card overflow-hidden shadow-sm bg-black/40 backdrop-blur-sm border border-white/10 transition-all duration-300">
            <div className="relative">
              <div className="p-3 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-secondary" onClick={()=>setWbOpen((v)=>!v)}>{wbOpen ? 'Hide Whiteboard' : 'Show Whiteboard'}</button>
                  <button className="btn-secondary" onClick={()=>{ setDocOpen(v=>!v); if (!docOpen) socketRef.current?.emit('doc:requestState'); }}>{docOpen ? 'Hide Doc' : 'Open Doc'}</button>
                  <button className="btn-primary" onClick={()=> { setSummaryBusy(true); setSummaryText(''); socketRef.current?.emit('stt:summary'); }} disabled={summaryBusy}>{summaryBusy ? 'Summarizing…' : 'Transcript Summary'}</button>
                </div>
              </div>
              {docOpen && (
                <div className="px-3 pb-3">
                  <div className="rounded-md border border-white/10 bg-black/30">
                    <div className="p-2 text-xs text-white/70">Shared Document</div>
                    <textarea
                      className="w-full h-40 p-3 bg-black/40 text-white outline-none resize-y"
                      value={docText}
                      onChange={(e)=>{ setDocText(e.target.value); emitDocUpdate(e.target.value); }}
                      placeholder="Start typing..."
                    />
                    {summaryText && (
                      <div className="p-3 text-sm text-white/80 border-t border-white/10">
                        <div className="font-semibold mb-1">AI Summary</div>
                        <div className="opacity-90">{summaryText}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {wbOpen && (
                <div className="px-3 pb-3">
                  <div className="rounded-md border border-[#2A2A2A] bg-white">
                    <div className="flex items-center gap-2 p-2 bg-[#f4f4f5] text-sm">
                      <label className="flex items-center gap-1">Color <input type="color" value={wbColor} onChange={(e)=>setWbColor(e.target.value)} /></label>
                      <label className="flex items-center gap-1">Size <input type="range" min={1} max={20} value={wbSize} onChange={(e)=>setWbSize(parseInt(e.target.value||'4'))} /></label>
                      <select className="border rounded px-2 py-1 bg-white text-black border-gray-300" value={wbToolRef.current} onChange={(e)=>{ wbToolRef.current = e.target.value as any; }}>
                        <option value="pencil">Pencil</option>
                        <option value="brush">Brush</option>
                        <option value="marker">Marker</option>
                        <option value="airbrush">Airbrush</option>
                        <option value="fill">Fill</option>
                        <option value="eraser">Eraser</option>
                      </select>
                      <button className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white border border-red-700/50" onClick={()=>{ clearWhiteboardCanvas(); socketRef.current?.emit('whiteboard:clear'); }}>Clear</button>
                      <button className="btn-secondary bg-white border border-[#e5e7eb]" onClick={downloadWhiteboardNow}>Download</button>
                    </div>
                    <div className="h-64 bg-white">
                      <canvas
                        ref={wbCanvasRef}
                        className="w-full h-64 touch-none"
                        onMouseDown={handleWbPointerDown}
                        onMouseMove={handleWbPointerMove}
                        onMouseUp={handleWbPointerUp}
                        onMouseLeave={handleWbPointerUp}
                        onTouchStart={handleWbTouchStart}
                        onTouchMove={handleWbTouchMove}
                        onTouchEnd={handleWbTouchEnd}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div
                ref={mountRef}
                className="h-[60vh] w-full"
                tabIndex={0}
                onKeyDown={(e)=>{
                  if (meetingEnded) return;
                  const scene = sceneRef.current; if (!scene) return;
                  const avatar = localAvatarRef.current; if (!avatar) return;
                  const camera = scene.children.find((c) => (c as any).isCamera) as any;
                  const step = 0.7;
                  let dx = 0, dz = 0;
                  if (e.key === 'ArrowUp' || e.key === 'w') dz -= step;
                  if (e.key === 'ArrowDown' || e.key === 's') dz += step;
                  if (e.key === 'ArrowLeft' || e.key === 'a') dx -= step;
                  if (e.key === 'ArrowRight' || e.key === 'd') dx += step;
                  if (dx === 0 && dz === 0) return;
                  // Move relative to camera orientation on ground plane
                  const yaw = camera && camera.rotation ? camera.rotation.y : 0;
                  const cos = Math.cos(yaw), sin = Math.sin(yaw);
                  const gx = dx * cos - dz * sin;
                  const gz = dx * sin + dz * cos;
                  const target = moveTargetRef.current ? moveTargetRef.current.clone() : avatar.position.clone();
                  target.x += gx; target.z += gz; target.y = 0;
                  moveTargetRef.current = target;
                  // Switch to walk animation while moving
                  const acts = localActionsRef.current;
                  if (acts && acts.walk && acts.current !== 'walk') {
                    try {
                      acts.idle?.fadeOut?.(0.2);
                      acts.walk.reset().fadeIn?.(0.2).play();
                      localActionsRef.current.current = 'walk';
                    } catch {}
                  }
                }}
                onKeyUp={(e)=>{
                  // Revert to idle when keys are released
                  const acts = localActionsRef.current;
                  if (acts && acts.idle && acts.current !== 'idle') {
                    try {
                      acts.walk?.fadeOut?.(0.2);
                      acts.idle.reset().fadeIn?.(0.2).play();
                      localActionsRef.current.current = 'idle';
                    } catch {}
                  }
                }}
                onMouseMove={(e) => {
                  if (meetingEnded) return;
                  if (!socketRef.current) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                  const scene = sceneRef.current; if (!scene) return;
                  const camera = scene.children.find((c) => (c as any).isCamera) as THREE.PerspectiveCamera | undefined; if (!camera) return;
                  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), camera);
                  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                  const point = new THREE.Vector3(); ray.ray.intersectPlane(plane, point);
                  socketRef.current.emit('cursor:pos', { userId: userIdRef.current, p: [point.x, 0.05, point.z] });
                }}
                onClick={(e) => {
                  if (meetingEnded) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                  const scene = sceneRef.current; if (!scene) return;
                  const camera = scene.children.find((c) => (c as any).isCamera) as THREE.PerspectiveCamera | undefined; if (!camera) return;
                  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), camera);
                  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                  const point = new THREE.Vector3(); ray.ray.intersectPlane(plane, point);
                  moveTargetRef.current = point.clone();
                }}
              />
            </div>
          </div>
          {joined && (
            <div className="mt-4">
              <div className="card shadow-sm bg-[#1E1E1E] border border-[#2A2A2A]">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Transcript Preview</h3>
                    <span className="text-xs text-white/70">Live speech-to-text</span>
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-[#2A2A2A] rounded p-3 bg-[#111111] text-sm whitespace-pre-wrap text-[#F1F1F1]" aria-live="polite">
                    {transcript && transcript.trim().length > 0 ? transcript : <span className="text-white/40">Listening…</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right sidebar: Chat */}
        <aside className="col-span-12 md:col-span-3">
          <div className="card shadow-sm bg-black/40 backdrop-blur-sm border border-white/10 transition-all duration-300 flex flex-col sticky top-4 h-[calc(100vh-6rem)]">
          <div className="card-body flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Chat</h3>
                <img src={avatarForUserId(userIdRef.current)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-6 w-6 rounded-full object-cover" />
              </div>
                <div className="mt-2 border border-[#2A2A2A] rounded p-2 bg-[#111111] flex-1 overflow-y-auto">
                  {chatLog.length === 0 ? (
                    <p className="text-xs text-[#A0A0A0]">No messages yet.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {chatLog.slice(-200).map((m,i)=> {
                        const isSelf = m.userId === userIdRef.current;
                        return (
                          <li key={m.ts+':'+i} className={`flex items-end ${isSelf ? 'justify-end' : 'justify-start'}`}>
                            <img src={avatarForUserId(m.userId)} onError={(e)=>{ e.currentTarget.src = avatarGallery[0]; }} className="h-6 w-6 rounded-full object-cover mr-2" />
                            <div className={`${isSelf ? 'bg-[#3D2C8D] text-white' : 'bg-[#2A2A2A] text-[#F1F1F1]'} rounded-2xl px-3 py-2 max-w-[75%] shadow-sm`}>
                              {!isSelf && <div className="text-[10px] text-[#A0A0A0] mb-0.5">{nameForUserId(m.userId)}</div>}
                              <div className="whitespace-pre-wrap break-words">{m.text}</div>
                              <div className={`text-[10px] mt-0.5 ${isSelf ? 'text-white/70' : 'text-[#A0A0A0]'}`}>{formatTime(m.ts)}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              <div className="mt-2 flex gap-2">
                <input className="input flex-1 bg-[#1E1E1E] text-[#F1F1F1] placeholder:text-[#A0A0A0] border border-[#2A2A2A]" placeholder="Type a message" value={chatInput} onChange={(e)=>{ if (meetingEnded) return; setChatInput(e.target.value);} } disabled={meetingEnded} onKeyDown={(e)=>{ if(meetingEnded) return; if(e.key==='Enter'){ const raw = chatInput.trim(); if(!raw) return; const text = medMode ? `[MED] ${raw}` : raw; const cid = `${userIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; chatSeenRef.current.add(cid); setChatLog(prev => [...prev, { userId: userIdRef.current, name: authedUser?.name || displayName, text, ts: Date.now() }]); socketRef.current?.emit('chat:message', { text, cid }); setChatInput(''); } }} />
                <button className="btn-primary shadow-sm hover:shadow bg-[#3D2C8D] hover:bg-[#7A00FF]" onClick={()=>{ if (meetingEnded) return; const raw = chatInput.trim(); if(!raw) return; const text = medMode ? `[MED] ${raw}` : raw; const cid = `${userIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; chatSeenRef.current.add(cid); setChatLog(prev => [...prev, { userId: userIdRef.current, name: authedUser?.name || displayName, text, ts: Date.now() }]); socketRef.current?.emit('chat:message', { text, cid }); setChatInput(''); }}>Send</button>
              </div>
            </div>
          </div>
          {!joined && (
            <div className="card mt-4 shadow-sm bg-[#1E1E1E] border border-[#2A2A2A]">
              <div className="card-body">
                <h3 className="text-[#F1F1F1] font-semibold tracking-wide">Transcript Preview</h3>
                <div className="mt-2 h-40 overflow-y-auto border border-[#2A2A2A] rounded p-2 bg-[#111111] text-sm whitespace-pre-wrap text-[#F1F1F1]">
                  {transcript}
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>


      <footer className="border-t border-[#2A2A2A] bg-[#0A0A0A]">
        <div className="container-page h-12 flex items-center justify-between text-sm text-[#A0A0A0]">
          <span>Three.js + WebXR scaffold</span>
          <span>Vite + React + Tailwind</span>
        </div>
      </footer>

      {!sessionReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
          {/* Background image with animated overlay */}
          <div className="absolute inset-0">
            <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#210C2E]/70 via-[#3D2C8D]/50 to-[#000000]/80" />
            {/* floating lights */}
            <div className="absolute -top-10 -left-10 h-40 w-40 bg-[#7A00FF]/40 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 h-48 w-48 bg-[#3D2C8D]/40 rounded-full blur-3xl animate-ping" />
          </div>
          {/* Glass card */}
          <div className="relative w-full max-w-lg px-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-10">
                <h3 className="text-center text-2xl font-semibold text-white tracking-wide">Welcome</h3>
                <div className="mt-6 space-y-4">
                  <input className="w-full rounded-full px-5 py-3 bg-white/10 border border-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-[#C63D5A] transition" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                  <input className="w-full rounded-full px-5 py-3 bg-white/10 border border-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-[#C63D5A] transition" placeholder="Password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                  {authMode === 'signup' && (
                    <input className="w-full rounded-full px-5 py-3 bg-white/10 border border-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-[#C63D5A] transition" placeholder="Display name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                  )}
                  <button className="w-full rounded-full px-5 py-3 text-white bg-gradient-to-r from-[#C63D5A] to-[#7A1136] hover:from-[#d44a68] hover:to-[#8a1a44] shadow-lg transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]" onClick={() => {
                    if (authMode==='signup') {
                      const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
                      const exists = accounts.find((a: any) => a.email === authEmail);
                      if (exists) { setErrorMsg('Account already exists'); return; }
                      const profile = { id: `u_${Math.random().toString(36).slice(2,10)}`, name: authName || 'User', email: authEmail, password: authPassword, avatar: { kind: 'image' as const, value: avatarImage } };
                      accounts.push(profile);
                      localStorage.setItem('accounts', JSON.stringify(accounts));
                      setErrorMsg(null);
                      setAuthMode('login');
                    } else {
                      const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
                      const found = accounts.find((a: any) => a.email === authEmail && a.password === authPassword);
                      if (!found) { setErrorMsg('Invalid credentials'); return; }
                      found.name = authName || found.name;
                      if (avatarImage) found.avatar = { kind: 'image', value: avatarImage };
                      localStorage.setItem('accounts', JSON.stringify(accounts));
                      localStorage.setItem('authUser', JSON.stringify(found));
                      setAuthedUser(found);
                      setDisplayName(found.name);
                      sessionStorage.setItem('sessionAuthed','1');
                      setSessionReady(true);
                      setAuthOpen(false);
                      setOnboardingOpen(true);
                      setErrorMsg(null);
                    }
                  }}>{authMode==='login' ? 'LOGIN' : 'CREATE ACCOUNT'}</button>
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <button className="hover:underline">Forgot Password ?</button>
                    <button className="hover:underline" onClick={() => setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Sign Up':'Back to Login'}</button>
                  </div>
                </div>
                <div className="mt-6 text-center text-white/80 text-xs">OR LOGIN WITH</div>
                <div className="mt-3 flex items-center justify-center gap-4">
                  <button disabled={oauthBusy} onClick={() => signInWithProvider('google')} className="h-11 w-11 rounded-full bg-white shadow hover:shadow-lg transition-transform hover:scale-105 active:scale-95 grid place-items-center">
                    <img alt="Google" className="h-6 w-6" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" />
                  </button>
                  <button disabled={oauthBusy} onClick={() => setPhoneOpen((v)=>!v)} className="h-11 w-11 rounded-full bg-[#10B981] shadow hover:shadow-lg transition-transform hover:scale-105 active:scale-95 grid place-items-center" title="Phone login">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-6 w-6"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.05-.24c1.15.38 2.39.59 3.54.59a1 1 0 011 1V21a1 1 0 01-1 1C10.07 22 2 13.93 2 3a1 1 0 011-1h3.47a1 1 0 011 1c0 1.15.21 2.39.59 3.54a1 1 0 01-.24 1.05l-2.2 2.2z"/></svg>
                  </button>
                </div> 
                {phoneOpen && (
                  <div className="mt-4 space-y-2">
                    <input className="w-full rounded-full px-5 py-3 bg-white/10 border border-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] transition" placeholder="Enter phone (e.g., +91XXXXXXXXXX)" value={phoneNumber} onChange={(e)=>setPhoneNumber(e.target.value)} />
                    <div id="recaptcha-container" />
                    <div className="flex items-center gap-2">
                      <button disabled={oauthBusy || !phoneNumber} onClick={sendPhoneOtp} className="rounded-full px-4 py-2 bg-[#10B981] text-white hover:brightness-110">Send OTP</button>
                      <input className="flex-1 rounded-full px-4 py-2 bg-white/10 border border-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-[#10B981]" placeholder="Enter OTP" value={otpCode} onChange={(e)=>setOtpCode(e.target.value)} />
                      <button disabled={oauthBusy || !otpCode} onClick={verifyPhoneOtp} className="rounded-full px-4 py-2 bg-[#10B981] text-white hover:brightness-110">Verify</button>
                    </div>
                    {phoneErr && (<div className="text-red-400 text-xs">{phoneErr}</div>)}
                  </div>
                )}
                {/* subtle floating animation for the card */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -inset-12 bg-gradient-to-tr from-white/10 to-transparent animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {onboardingOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#3D2C8D]/40 to-black/80" />
            <div className="absolute -top-12 left-10 h-40 w-40 bg-[#7A00FF]/40 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-0 h-56 w-56 bg-[#C63D5A]/30 rounded-full blur-3xl animate-ping" />
          </div>
          <div className="relative w-full max-w-2xl px-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-10">
                <h3 className="text-center text-2xl font-semibold text-white tracking-wide">Pick Your Persona</h3>
                <p className="text-center text-white/80 text-sm mt-1">Smooth transitions and a 3D vibe like the sample image</p>
                <div
                  className="mt-6 relative select-none"
                  onTouchStart={(e)=>{ swipeStartXRef.current = e.touches[0]?.clientX ?? null; }}
                  onTouchEnd={(e)=>{ const sx = swipeStartXRef.current; const ex = e.changedTouches[0]?.clientX ?? 0; swipeStartXRef.current = null; if (sx==null) return; const dx = ex - sx; if (Math.abs(dx) > 40) { dx>0 ? prevAvatar() : nextAvatar(); } }}
                >
                  <div className="relative h-64 sm:h-80">
                    {animatedAvatars.map((src, i) => (
                      <div key={src} className={`absolute inset-0 m-auto h-64 sm:h-80 w-full flex items-center justify-center transition-all duration-700 ${i===avatarIdx? 'opacity-100 scale-100 rotate-0':'opacity-0 scale-95 -rotate-2'}`}>
                        <div className={`rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-xl border ${i===avatarIdx? 'border-white/40 shadow-2xl':'border-white/10 shadow'} ${i===avatarIdx? 'animate-pulse':''}`}>
                          <img
                            src={toImageSrc(src)}
                            alt="avatar"
                            referrerPolicy="no-referrer"
                            className="h-60 sm:h-72 object-contain rounded-xl"
                            onError={(e) => {
                              // fallback to animated person gif (non-meeting)
                              e.currentTarget.src = avatarFallbacks[i % avatarFallbacks.length];
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <button className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center backdrop-blur transition-transform hover:scale-110" onClick={prevAvatar}>
                      <span className="text-xl">‹</span>
                    </button>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center backdrop-blur transition-transform hover:scale-110" onClick={nextAvatar}>
                      <span className="text-xl">›</span>
                    </button>
                  </div>
                </div>
                {/* Thumbnails removed as requested; swipe-only selection */}
                <div className="mt-6 flex items-center justify-center">
                  <button
                    className="rounded-full px-7 py-3 text-white bg-gradient-to-r from-[#C63D5A] to-[#7A1136] hover:from-[#d44a68] hover:to-[#8a1a44] shadow-xl transition-transform duration-200 hover:scale-[1.03] active:scale-[0.99]"
                    onClick={() => {
                      const chosenGif = animatedAvatars[avatarIdx];
                      const chosenModel = modelUrls[avatarIdx % modelUrls.length];
                      // Save as model avatar for in-world character
                      const updated = authedUser ? { ...authedUser, avatar: { kind: 'model' as const, value: chosenModel } } : null;
                      if (updated) {
                        setAuthedUser(updated);
                        try {
                          localStorage.setItem('authUser', JSON.stringify(updated));
                          const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
                          const idx = accounts.findIndex((a: any) => a.email === updated.email);
                          if (idx>=0) { accounts[idx] = { ...accounts[idx], avatar: updated.avatar }; localStorage.setItem('accounts', JSON.stringify(accounts)); }
                        } catch {}
                        setRoster((prev) => prev.map((m) => (m.id === userIdRef.current ? { ...m, avatar: updated.avatar } : m)));
                      }
                      setAvatarImage(chosenGif);
                      setOnboardingOpen(false);
                      setLobbyMode('idle');
                    }}
                  >Enter</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboardOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDashboardOpen(false)} />
          <div className="relative w-full max-w-4xl mx-auto">
            <div className="card rounded-2xl shadow-2xl backdrop-blur bg-[#1E1E1E] border border-[#2A2A2A]">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[#F1F1F1]">Meeting Dashboard</h3>
                  <button className="px-3 py-1.5 rounded-md bg-[#3D2C8D] hover:bg-[#7A00FF] text-white border border-white/20 transition-colors" onClick={() => setDashboardOpen(false)}>Close</button>
                </div>
                {meetings.length === 0 ? (
                  <p className="text-sm text-[#A0A0A0] mt-2">No past meetings yet.</p>
                ) : (
                  <div className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto">
                    {meetings.slice().reverse().map((m) => (
                      <div key={m.id} className="border border-[#2A2A2A] rounded-lg p-3 bg-[#111111] shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{m.title}</div>
                            <div className="text-xs text-[#A0A0A0]">{new Date(m.ts).toLocaleString()} · Room {m.roomId || '-'}</div>
                            <div className="text-xs text-[#A0A0A0]">Participants: {m.participants.map(p=>p.name).join(', ') || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="btn-secondary hover:brightness-110 bg-[#3D2C8D] hover:bg-[#7A00FF] text-white"
                              onClick={() => {
                                const text = [
                                  `Title: ${m.title}`,
                                  `When: ${new Date(m.ts).toLocaleString()}`,
                                  `Room: ${m.roomId || '-'}`,
                                  `Participants: ${m.participants.map(p=>p.name).join(', ')}`,
                                  '',
                                  'Summary:',
                                  ...(m.summary||[]).map(s=>`- ${s}`),
                                  '',
                                  'Transcript:',
                                  m.transcript || '(empty)'
                                ].join('\n');
                                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `${m.title.replace(/[^a-z0-9_\- ]/gi,'_')}.txt`;
                                a.click(); URL.revokeObjectURL(url);
                              }}
                            >Download Notes</button>
                            {m.whiteboardImage && (
                              <a className="btn-secondary hover:brightness-110 bg-[#3D2C8D] hover:bg-[#7A00FF] text-white" href={m.whiteboardImage} download={`whiteboard_${m.id}.png`}>Download Whiteboard</a>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const display = (m.summary && m.summary.length > 0)
                            ? m.summary
                            : buildSummary(m.transcript || '', m.chat || []);
                          return display && display.length > 0 ? (
                            <ul className="mt-2 list-disc list-inside text-sm text-[#F1F1F1]">
                              {display.slice(-6).map((s,i)=>(<li key={i}>{s}</li>))}
                            </ul>
                          ) : null;
                        })()}
                        {m.chat && m.chat.length>0 && (
                          <div className="mt-2 text-xs text-[#A0A0A0]">
                            Recent chat: {m.chat.slice(-5).map(c=>c.name+': '+c.text).join(' · ')}
                          </div>
                        )}
                        {m.whiteboardImage && (
                          <div className="mt-2">
                            <img src={m.whiteboardImage} alt="Whiteboard snapshot" className="max-h-48 rounded border border-[#2A2A2A]" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Whiteboard helpers (component scope)
function getCanvasCtx(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  return canvas.getContext('2d');
}