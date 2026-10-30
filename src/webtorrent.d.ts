declare module 'webtorrent' {
  const WebTorrent: any;
  export default WebTorrent;
}

declare module 'fs-access-chunk-store' {
  const createStore: (chunkLength: number, options?: any) => any;
  export default createStore;
}
