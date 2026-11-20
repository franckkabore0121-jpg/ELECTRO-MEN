export function getServerPort(argv: readonly string[], env: Record<string, string | undefined>): number {
  const portIndex = argv.indexOf('--port');
  if (portIndex !== -1 && argv[portIndex + 1]) {
    return parseInt(argv[portIndex + 1], 10);
  }
  if (env.NODE_ENV === 'production' && env.PORT) {
    return parseInt(env.PORT, 10);
  }
  return 3000;
}
