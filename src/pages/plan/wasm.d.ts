// `?url&inline` makes Vite hand the HiGHS binary over as a base64 data: URL inside the JavaScript.
declare module 'highs/runtime?url&inline' {
  const dataUrl: string;
  export default dataUrl;
}
