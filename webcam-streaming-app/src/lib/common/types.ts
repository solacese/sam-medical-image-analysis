export interface SolaceConfig {
  url: string;
  vpnName: string;
  username: string;
  password: string;
}

export interface AppConfig {
  videoTopic: string;
  statusTopic: string;
  solace: SolaceConfig;
}

export interface ScannerStatus {
  scannerId: string;
  sequence: string;      // e.g. "T1 Axial", "T2 FLAIR"
  fps: number;
  timestamp: string;
}
