import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.shijie.suanfa",
  appName: "世界算法",
  webDir: "dist",
  backgroundColor: "#111111",
  android: {
    backgroundColor: "#111111",
  },
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
