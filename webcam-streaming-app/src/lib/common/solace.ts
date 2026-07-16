/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { SolaceConfig } from './types';
import { DEMO_MODE } from './config';
import * as solace from 'solclientjs';

// Demo session type
interface DemoSession {
  connected: boolean;
  demo: boolean;
}

/**
 * SolaceVideoClient — thin wrapper over solclientjs for streaming MRI scanner
 * video frames over Solace PubSub+.
 *
 * The scanner console publishes JPEG frames as binary attachments with a small
 * text header:  frameId|timestamp|frameSize|<binary JPEG bytes>
 * Reading stations subscribe to the video topic and receive rendered data URLs.
 */
export class SolaceVideoClient {
  private session: solace.Session | DemoSession | null = null;
  private sessionEventCb: any = null;
  private messageEventCb: any = null;
  private onFrameCallback?: (imageData: string) => void;
  private topicCallbacks: Map<string, Array<(payload: any) => void>> = new Map();
  private isConnected = false;
  private subscriptions: Set<string> = new Set();
  private demoInterval?: number;
  private frameCounter = 0;
  private static factoryInitialized = false;

  constructor(private config: SolaceConfig) {
    if (!DEMO_MODE) {
      this.initializeSolaceFactory();
    }
  }

  private initializeSolaceFactory(): void {
    if (SolaceVideoClient.factoryInitialized) return;

    try {
      // @ts-ignore
      const factoryProps = new solace.SolclientFactoryProperties();
      factoryProps.profile = solace.SolclientFactoryProfiles.version10;
      solace.SolclientFactory.init(factoryProps);
      SolaceVideoClient.factoryInitialized = true;
      console.log('✅ Solace factory initialized');
    } catch (error: unknown) {
      console.error('❌ Failed to initialize Solace factory:', error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (DEMO_MODE) {
      return this.connectDemo();
    }

    return new Promise((resolve, reject) => {
      try {
        const sessionProperties = new solace.SessionProperties({
          url: this.config.url,
          vpnName: this.config.vpnName,
          userName: this.config.username,
          password: this.config.password,
          connectRetries: 3,
          reconnectRetries: 3,
          reconnectRetryWaitInMsecs: 3000
        });

        console.log(`🔗 Attempting Solace connection to: ${this.config.url} (VPN: ${this.config.vpnName})`);
        this.session = solace.SolclientFactory.createSession(sessionProperties);

        this.sessionEventCb = (sessionEvent: any) => {
          const eventType = sessionEvent.type || sessionEvent.sessionEventCode;
          const eventInfo = sessionEvent.infoStr || '';

          if (eventType === solace.SessionEventCode.UP_NOTICE) {
            console.log('✅ Solace session connected');
            this.isConnected = true;
            resolve();
          } else if (eventType === solace.SessionEventCode.CONNECT_FAILED_ERROR) {
            console.error('❌ Solace connection failed:', eventInfo);
            this.isConnected = false;
            reject(new Error(`Connection failed: ${eventInfo}`));
          } else if (eventType === solace.SessionEventCode.DISCONNECTED) {
            console.log('⚠️ Solace session disconnected');
            this.isConnected = false;
          } else if (eventType === solace.SessionEventCode.SUBSCRIPTION_ERROR) {
            console.error('❌ Solace subscription error:', eventInfo);
          } else if (eventType === solace.SessionEventCode.RECONNECTING_NOTICE) {
            console.log('🔄 Reconnecting to Solace broker...');
          } else if (eventType === solace.SessionEventCode.RECONNECTED_NOTICE) {
            console.log('✅ Reconnected to Solace broker');
          }
        };

        this.messageEventCb = (message: any) => this.handleMessage(message);

        this.session.on(solace.SessionEventCode.UP_NOTICE, this.sessionEventCb);
        this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, this.sessionEventCb);
        this.session.on(solace.SessionEventCode.DISCONNECTED, this.sessionEventCb);
        this.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, this.sessionEventCb);
        this.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, this.sessionEventCb);
        this.session.on(solace.SessionEventCode.MESSAGE, this.messageEventCb);

        this.session.connect();
      } catch (error: unknown) {
        console.error('❌ Failed to create Solace session:', error);
        reject(error);
      }
    });
  }

  private async connectDemo(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Running in demo mode - simulating Solace connection');
      setTimeout(() => {
        this.session = { connected: true, demo: true } as DemoSession;
        this.isConnected = true;
        resolve();
      }, 800);
    });
  }

  /** Subscribe to a video feed topic. Rendered frames are delivered as data URLs. */
  subscribe(topic: string, onFrame: (imageData: string) => void): void {
    this.onFrameCallback = onFrame;

    if (DEMO_MODE || (this.session && 'demo' in this.session && this.session.demo)) {
      this.startDemoVideoFeed();
      return;
    }

    if (!this.session || !this.isConnected || 'demo' in this.session) {
      console.error('Solace session not connected');
      return;
    }

    try {
      const streamTopic = solace.SolclientFactory.createTopicDestination(topic);
      this.session.subscribe(streamTopic, true, topic, 10000);
      this.subscriptions.add(topic);
      console.log(`Subscribed to video stream topic: ${topic}`);
    } catch (error: unknown) {
      console.error('Failed to subscribe to stream topic:', error);
    }
  }

  /** Subscribe to a JSON control/status topic. */
  subscribeToTopic(topic: string, onMessage: (payload: any) => void): void {
    if (!topic || topic.trim() === '') return;

    if (DEMO_MODE || (this.session && 'demo' in this.session && this.session.demo)) {
      return;
    }

    if (!this.session || !this.isConnected || 'demo' in this.session) {
      console.error('Solace session not connected');
      return;
    }

    try {
      const existing = this.topicCallbacks.get(topic);
      if (existing) {
        existing.push(onMessage);
      } else {
        this.topicCallbacks.set(topic, [onMessage]);
        const destination = solace.SolclientFactory.createTopicDestination(topic);
        this.session.subscribe(destination, true, topic, 10000);
        this.subscriptions.add(topic);
      }
    } catch (error: unknown) {
      console.error('Failed to subscribe to topic:', error);
    }
  }

  private startDemoVideoFeed(): void {
    if (this.demoInterval) clearInterval(this.demoInterval);

    // Render a synthetic "MRI-like" sweeping scan animation at ~10 FPS.
    this.demoInterval = window.setInterval(() => {
      if (!this.onFrameCallback) return;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const time = Date.now() / 1000;
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, 640, 480);

      // Concentric "slice" rings
      ctx.save();
      ctx.translate(320, 240);
      for (let r = 20; r < 240; r += 22) {
        const pulse = Math.sin(time * 1.5 + r * 0.03) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(123, 97, 255, ${0.15 + pulse * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Sweeping scan line
      const angle = time * 1.2;
      ctx.strokeStyle = 'rgba(165, 148, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 240, Math.sin(angle) * 240);
      ctx.stroke();
      ctx.restore();

      // Labels
      ctx.fillStyle = '#A594FF';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('GE HealthCare MRI (Demo)', 20, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText(new Date().toLocaleTimeString(), 20, 66);
      ctx.fillStyle = '#7B61FF';
      ctx.font = '14px monospace';
      ctx.fillText('T1 AXIAL · SLICE ' + (Math.floor(time * 2) % 128), 20, 460);

      this.onFrameCallback(canvas.toDataURL('image/jpeg', 0.8));
    }, 100);
  }

  private handleMessage(message: any): void {
    try {
      const destination = message.getDestination();
      if (!destination) return;

      const topic = destination.getName();
      const binaryAttachment = message.getBinaryAttachment();
      if (!binaryAttachment) return;

      // JSON control/status callbacks registered via subscribeToTopic()
      const topicCallbacks = this.topicCallbacks.get(topic);
      if (topicCallbacks && topicCallbacks.length > 0) {
        let payload: any = null;
        try {
          payload = JSON.parse(binaryAttachment);
        } catch {
          // non-JSON — invoke with null
        }
        topicCallbacks.forEach(cb => cb(payload));
        return;
      }

      // Video stream messages registered via subscribe()
      if (this.onFrameCallback && !this.topicCallbacks.has(topic)) {
        try {
          const payload = JSON.parse(binaryAttachment);
          if (payload.type === 'inactive') {
            this.onFrameCallback('INACTIVE');
            return;
          }
        } catch {
          // not JSON — treat as binary frame format
        }
        this.handleStreamMessage(binaryAttachment);
      }
    } catch (error: unknown) {
      console.error('Error handling message:', error);
    }
  }

  private handleStreamMessage(binaryData: string): void {
    try {
      // Parse header: frameId|timestamp|frameSize|<binary JPEG data>
      let pipeCount = 0;
      let headerEndIndex = -1;
      for (let i = 0; i < binaryData.length && pipeCount < 3; i++) {
        if (binaryData.charCodeAt(i) === 124) { // '|'
          pipeCount++;
          if (pipeCount === 3) { headerEndIndex = i; break; }
        }
      }
      if (headerEndIndex === -1) {
        console.warn('Invalid frame format: header not found');
        return;
      }

      const jpegData = binaryData.substring(headerEndIndex + 1);
      const base64Data = btoa(jpegData);
      const imageData = `data:image/jpeg;base64,${base64Data}`;
      this.onFrameCallback?.(imageData);
    } catch (error: unknown) {
      console.error('Error handling stream message:', error);
    }
  }

  /** Publish a JSON control/status message. */
  publishControl(topic: string, payload: any): void {
    if (DEMO_MODE) return;
    if (!this.session || !this.isConnected || 'demo' in this.session) {
      console.warn(`⚠️ Cannot publish to ${topic}: session not ready (connected=${this.isConnected})`);
      return;
    }

    try {
      const message = solace.SolclientFactory.createMessage();
      message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
      message.setBinaryAttachment(JSON.stringify(payload));
      message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
      this.session.send(message);
      console.log(`✅ Published to ${topic}:`, payload);
    } catch (error: unknown) {
      console.error('Failed to publish control message:', error);
    }
  }

  /** Publish a single JPEG video frame to the given topic. */
  publishVideoFrame(topic: string, jpegBuffer: ArrayBuffer): void {
    if (DEMO_MODE || !this.session || !this.isConnected || 'demo' in this.session) return;

    try {
      const frameId = String(this.frameCounter++);
      const timestamp = String(Date.now());
      const frameSize = String(jpegBuffer.byteLength);
      const headerBytes = new TextEncoder().encode(`${frameId}|${timestamp}|${frameSize}|`);
      const jpegBytes = new Uint8Array(jpegBuffer);
      const combined = new Uint8Array(headerBytes.length + jpegBytes.length);
      combined.set(headerBytes, 0);
      combined.set(jpegBytes, headerBytes.length);

      const message = solace.SolclientFactory.createMessage();
      message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
      message.setBinaryAttachment(combined);
      message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
      (this.session as solace.Session).send(message);
    } catch (error: unknown) {
      console.error('Failed to publish video frame:', error);
    }
  }

  unsubscribeFromTopic(topic: string): void {
    if (DEMO_MODE || !this.session || !this.isConnected || 'demo' in this.session) {
      this.topicCallbacks.delete(topic);
      return;
    }
    try {
      if (this.topicCallbacks.has(topic)) {
        this.topicCallbacks.delete(topic);
        if (this.subscriptions.has(topic)) {
          const destination = solace.SolclientFactory.createTopicDestination(topic);
          this.session.unsubscribe(destination, true, topic, 10000);
          this.subscriptions.delete(topic);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to unsubscribe from topic:', error);
    }
  }

  /** Check if the Solace session is connected. */
  isReadyForPublish(): boolean {
    return this.isConnected && this.session !== null && !('demo' in this.session);
  }

  /** Disconnect the Solace session. */
  disconnect(): void {
    if (DEMO_MODE || !this.session || 'demo' in this.session) return;
    try {
      (this.session as solace.Session).disconnect();
    } catch (error: unknown) {
      console.error('Error disconnecting:', error);
    }
  }

  unsubscribe(topic: string): void {
    if (DEMO_MODE || (this.session && 'demo' in this.session && this.session.demo)) {
      if (this.demoInterval) {
        clearInterval(this.demoInterval);
        this.demoInterval = undefined;
      }
      return;
    }
    if (!this.session || !this.isConnected || 'demo' in this.session) return;

    try {
      const streamTopic = solace.SolclientFactory.createTopicDestination(topic);
      if (this.subscriptions.has(topic)) {
        this.session.unsubscribe(streamTopic, true, topic, 10000);
        this.subscriptions.delete(topic);
      }
    } catch (error: unknown) {
      console.error('Failed to unsubscribe from stream topic:', error);
    }
  }

  disconnect(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = undefined;
    }

    if (DEMO_MODE || (this.session && 'demo' in this.session && this.session.demo)) {
      this.session = null;
      this.isConnected = false;
      return;
    }

    if (this.session && !('demo' in this.session)) {
      try {
        this.subscriptions.forEach(topic => {
          const destination = solace.SolclientFactory.createTopicDestination(topic);
          (this.session as solace.Session)?.unsubscribe(destination, true, topic, 10000);
        });
        this.subscriptions.clear();
        this.session.disconnect();
        this.session.dispose();
        this.session = null;
        this.isConnected = false;
      } catch (error: unknown) {
        console.error('Error during disconnect:', error);
      }
    }
  }

  isSessionConnected(): boolean {
    return this.isConnected && this.session !== null;
  }
}
