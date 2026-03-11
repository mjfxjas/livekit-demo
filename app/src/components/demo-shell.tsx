'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  LoaderCircle,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  ShieldCheck,
  Unplug,
  Volume2,
  VolumeX,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ConnectionState,
  createLocalAudioTrack,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SessionState = {
  token: string;
  room: string;
  identity: string;
  url: string;
};

type TranscriptItem = {
  speaker: string;
  text: string;
};

type ConciergeResponse = {
  reply: string;
  mode?: string;
  provider?: string;
  model?: string;
};

export function DemoShell() {
  const [name, setName] = useState('Jon');
  const [message, setMessage] = useState('How would you frame a LiveKit proof-of-concept for a customer?');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicLoading, setIsMicLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [responseMode, setResponseMode] = useState('mock-concierge');
  const [providerLabel, setProviderLabel] = useState('fallback');
  const [modelLabel, setModelLabel] = useState('mock-concierge');
  const [micLevel, setMicLevel] = useState(0);
  const [isSpeakingDetected, setIsSpeakingDetected] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionSupported, setTranscriptionSupported] = useState(false);
  const [autoSendTranscript, setAutoSendTranscript] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    { speaker: 'system', text: 'Waiting for LiveKit room connection.' },
    { speaker: 'agent', text: 'LLM mode activates automatically when a supported backend provider is configured. Browser speech playback is local and free.' },
  ]);

  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const derivedStatus = useMemo(() => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Connecting:
        return 'Connecting';
      case ConnectionState.Reconnecting:
        return 'Reconnecting';
      default:
        return 'Disconnected';
    }
  }, [connectionState]);

  const stopMicMeter = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setMicLevel(0);
    setIsSpeakingDetected(false);
  }, []);

  const stopTranscription = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsTranscribing(false);
    setLiveTranscript('');
  }, []);

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    const micTrack = micTrackRef.current;

    if (micTrack && room) {
      await room.localParticipant.unpublishTrack(micTrack).catch(() => undefined);
      micTrack.stop();
      micTrack.mediaStreamTrack.stop();
      micTrackRef.current = null;
    }

    stopMicMeter();
    stopTranscription();

    remoteAudioEls.current.forEach((element) => {
      element.pause();
      element.remove();
    });
    remoteAudioEls.current.clear();

    if (room) {
      room.disconnect(true);
      roomRef.current = null;
    }

    setConnectionState(ConnectionState.Disconnected);
    setIsMicEnabled(false);
    setParticipantCount(0);
  }, [stopMicMeter, stopTranscription]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setTranscriptionSupported(Boolean(Recognition));
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      stopMicMeter();
      stopTranscription();
      void disconnectRoom();
    };
  }, [disconnectRoom, stopMicMeter, stopTranscription]);

  const speakText = useCallback((text: string) => {
    if (!speechEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [speechEnabled]);

  function startMicMeter(track: LocalAudioTrack) {
    stopMicMeter();

    const mediaTrack = track.mediaStreamTrack;
    const stream = new MediaStream([mediaTrack]);
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceNodeRef.current = source;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      const normalized = Math.min(avg / 90, 1);
      setMicLevel(normalized);
      setIsSpeakingDetected(normalized > 0.12);
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();
  }

  const runConcierge = useCallback(
    async (outgoing: string, opts?: { alreadyLoggedUser?: boolean; clearComposer?: boolean }) => {
      if (!outgoing.trim()) return;

      setIsSending(true);
      setError(null);

      if (!opts?.alreadyLoggedUser) {
        setTranscript((current) => [{ speaker: name || 'user', text: outgoing }, ...current]);
      }

      try {
        const response = await fetch('/api/concierge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: outgoing }),
        });

        const data: ConciergeResponse & { error?: string } = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to contact concierge');
        }

        setResponseMode(data.mode || 'mock-concierge');
        setProviderLabel(data.provider || 'fallback');
        setModelLabel(data.model || data.mode || 'mock-concierge');
        setTranscript((current) => [{ speaker: 'agent', text: data.reply }, ...current]);
        speakText(data.reply);

        if (opts?.clearComposer) {
          setMessage('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setIsSending(false);
      }
    },
    [name, speakText],
  );

  function startTranscription() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Browser speech recognition is not supported here. Chrome usually works best.');
      return;
    }

    stopTranscription();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsTranscribing(true);
      setTranscript((current) => [
        { speaker: 'system', text: autoSendTranscript ? 'Browser transcription started. Finalized speech will auto-send to the concierge.' : 'Browser transcription started.' },
        ...current,
      ]);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          finalText += `${text} `;
        } else {
          interim += `${text} `;
        }
      }

      if (interim.trim()) {
        setLiveTranscript(interim.trim());
      }

      if (finalText.trim()) {
        const cleaned = finalText.trim();
        setLiveTranscript('');
        setTranscript((current) => [{ speaker: name || 'user', text: cleaned }, ...current]);

        if (autoSendTranscript) {
          void runConcierge(cleaned, { alreadyLoggedUser: true });
        }
      }
    };

    recognition.onerror = (event) => {
      setError(`Transcription error: ${event.error}`);
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      setIsTranscribing(false);
      setLiveTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function createSession() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create LiveKit session');
      }

      setSession(data);
      setTranscript((current) => [
        { speaker: 'system', text: `Token issued for ${data.identity} in room ${data.room}.` },
        ...current,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function connectRoom() {
    if (!session?.token || !session.url) {
      setError('Missing token or LiveKit URL.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      if (roomRef.current) {
        await disconnectRoom();
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(state);
        })
        .on(RoomEvent.ParticipantConnected, () => {
          setParticipantCount(room.numParticipants);
          setTranscript((current) => [
            { speaker: 'system', text: 'A remote participant joined the room.' },
            ...current,
          ]);
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          setParticipantCount(room.numParticipants);
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const element = track.attach();
            element.autoplay = true;
            remoteAudioEls.current.set(publication.trackSid, element as HTMLAudioElement);
            setTranscript((current) => [
              { speaker: participant.identity, text: 'Remote audio track subscribed.' },
              ...current,
            ]);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track, publication) => {
          if (track.kind === Track.Kind.Audio) {
            const element = remoteAudioEls.current.get(publication.trackSid);
            if (element) {
              track.detach(element);
              element.remove();
              remoteAudioEls.current.delete(publication.trackSid);
            }
          }
        })
        .on(RoomEvent.Disconnected, () => {
          setIsMicEnabled(false);
          setParticipantCount(0);
          stopMicMeter();
          stopTranscription();
        });

      await room.connect(session.url, session.token);
      roomRef.current = room;
      setParticipantCount(room.numParticipants);
      setTranscript((current) => [
        { speaker: 'system', text: `Connected to ${session.room}.` },
        ...current,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to room');
    } finally {
      setIsConnecting(false);
    }
  }

  async function enableMicrophone() {
    const room = roomRef.current;
    if (!room) {
      setError('Join the room before publishing microphone audio.');
      return;
    }

    setIsMicLoading(true);
    setError(null);

    try {
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
      });

      await room.localParticipant.publishTrack(track, {
        source: Track.Source.Microphone,
      });

      micTrackRef.current = track;
      startMicMeter(track);
      setIsMicEnabled(true);
      setTranscript((current) => [
        { speaker: 'system', text: 'Microphone published to LiveKit room.' },
        ...current,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable microphone');
    } finally {
      setIsMicLoading(false);
    }
  }

  async function disableMicrophone() {
    const room = roomRef.current;
    const track = micTrackRef.current;
    if (!room || !track) return;

    await room.localParticipant.unpublishTrack(track);
    track.stop();
    track.mediaStreamTrack.stop();
    micTrackRef.current = null;
    stopMicMeter();
    stopTranscription();
    setIsMicEnabled(false);
    setTranscript((current) => [
      { speaker: 'system', text: 'Microphone unpublished.' },
      ...current,
    ]);
  }

  async function sendTypedMessage() {
    const outgoing = message.trim();
    if (!outgoing) return;
    await runConcierge(outgoing, { clearComposer: true });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
              <Radio className="h-4 w-4" />
              LiveKit voice concierge demo
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Real-time voice AI demo built to show how I’d implement LiveKit for customer-facing use cases.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-neutral-300">
              Small by design: one room, one user, one fast path from browser to session token to live voice interaction.
              This is the sales-engineer proof piece, not the giant product.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureCard icon={Mic} title="Voice-first UX" text="Join a room fast and visibly verify live microphone activity." />
              <FeatureCard icon={AudioLines} title="Realtime session" text="Browser connects to LiveKit and publishes microphone audio into the room." />
              <FeatureCard icon={ShieldCheck} title="Working voice loop" text="Finalized speech can auto-trigger concierge responses and spoken playback." />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Session bootstrap</h2>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                MVP complete
              </span>
            </div>

            <label className="mb-3 block text-sm text-neutral-300">Display name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400/50"
              placeholder="Your name"
            />

            <div className="mt-4 grid gap-3">
              <button
                onClick={createSession}
                disabled={isLoading}
                className={clsx(
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-medium transition',
                  isLoading ? 'bg-neutral-700 text-neutral-300' : 'bg-cyan-400 text-neutral-950 hover:bg-cyan-300',
                )}
              >
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                {isLoading ? 'Creating session...' : 'Create LiveKit session'}
              </button>

              <button
                onClick={connectRoom}
                disabled={!session || isConnecting || connectionState === ConnectionState.Connected}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                {isConnecting ? 'Connecting...' : 'Join room'}
              </button>

              <button
                onClick={isMicEnabled ? disableMicrophone : enableMicrophone}
                disabled={connectionState !== ConnectionState.Connected || isMicLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMicLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : isMicEnabled ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {isMicLoading ? 'Updating mic...' : isMicEnabled ? 'Mute / unpublish mic' : 'Publish mic'}
              </button>

              <button
                onClick={isTranscribing ? stopTranscription : startTranscription}
                disabled={!isMicEnabled || !transcriptionSupported}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4" />
                {isTranscribing ? 'Stop transcription' : 'Start browser transcription'}
              </button>

              <button
                onClick={() => setAutoSendTranscript((value) => !value)}
                disabled={!transcriptionSupported}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {autoSendTranscript ? 'Auto-send transcript on' : 'Auto-send transcript off'}
              </button>

              <button
                onClick={() => setSpeechEnabled((value) => !value)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium transition hover:bg-white/10"
              >
                {speechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {speechEnabled ? 'Browser speech on' : 'Browser speech off'}
              </button>

              <button
                onClick={() => void disconnectRoom()}
                disabled={connectionState === ConnectionState.Disconnected}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 font-medium text-rose-200 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Unplug className="h-4 w-4" />
                Disconnect room
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-white">Mic activity</p>
                <span className={clsx('rounded-full px-2 py-1 text-xs', isSpeakingDetected ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-neutral-300')}>
                  {isSpeakingDetected ? 'speaking detected' : 'idle'}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={clsx('h-full rounded-full transition-all', isMicEnabled ? 'bg-cyan-300' : 'bg-neutral-600')}
                  style={{ width: `${Math.max(micLevel * 100, isMicEnabled ? 2 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                This is a local input meter so you can verify the mic is actually live even before transcription/voice-agent logic is added.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-white">Browser transcription</p>
                <span className={clsx('rounded-full px-2 py-1 text-xs', isTranscribing ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-neutral-300')}>
                  {isTranscribing ? 'listening' : transcriptionSupported ? 'available' : 'unsupported'}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Cheapest option: browser-native speech recognition. Usually free, usually best in Chrome, and good enough for demo validation.
              </p>
              {liveTranscript ? (
                <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
                  <span className="block text-xs uppercase tracking-wide text-cyan-300">Live transcript</span>
                  {liveTranscript}
                </div>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
              <p className="font-medium text-white">Current status</p>
              {session ? (
                <div className="mt-3 space-y-2 break-all">
                  <p><span className="text-neutral-500">identity:</span> {session.identity}</p>
                  <p><span className="text-neutral-500">room:</span> {session.room}</p>
                  <p><span className="text-neutral-500">url:</span> {session.url || 'missing NEXT_PUBLIC_LIVEKIT_URL'}</p>
                  <p><span className="text-neutral-500">connection:</span> {derivedStatus}</p>
                  <p><span className="text-neutral-500">participants:</span> {participantCount}</p>
                  <p><span className="text-neutral-500">mic:</span> {isMicEnabled ? 'published' : 'not published'}</p>
                  <p><span className="text-neutral-500">transcription:</span> {isTranscribing ? 'running' : transcriptionSupported ? 'available' : 'unsupported'}</p>
                  <p><span className="text-neutral-500">auto-send:</span> {autoSendTranscript ? 'on' : 'off'}</p>
                  <p><span className="text-neutral-500">provider:</span> {providerLabel}</p>
                  <p><span className="text-neutral-500">model:</span> {modelLabel}</p>
                  <p><span className="text-neutral-500">response mode:</span> {responseMode}</p>
                </div>
              ) : (
                <p className="mt-2">No session created yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-cyan-300" />
              <h2 className="text-xl font-semibold">Concierge chat</h2>
            </div>
            <p className="mt-3 text-neutral-300">
              Concierge replies come from the first available backend path: <strong>Bedrock</strong>, then <strong>OpenAI</strong>, then the local fallback. Finalized speech can now auto-send into the same loop as typed chat.
            </p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-4 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-cyan-400/50"
              placeholder="Ask the concierge how it would handle architecture, POCs, pricing, scale, or onboarding."
            />
            <button
              onClick={sendTypedMessage}
              disabled={isSending || !message.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? 'Sending...' : 'Send to concierge'}
            </button>

            <ul className="mt-6 space-y-3 text-neutral-300">
              <li>• Bedrock Haiku is the cheap preferred path right now.</li>
              <li>• Browser speech synthesis is local/free.</li>
              <li>• Browser transcription is also usually free when supported.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
            <h2 className="text-xl font-semibold">Transcript panel</h2>
            <div className="mt-4 space-y-3">
              {transcript.map((item, index) => (
                <div key={`${item.speaker}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">{item.speaker}</p>
                  <p className="mt-1 text-neutral-100">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type FeatureCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
};

function FeatureCard({ icon: Icon, title, text }: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-neutral-400">{text}</p>
    </div>
  );
}
