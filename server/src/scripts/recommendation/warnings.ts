const delay = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

type WarnBeforeOpenAiCallsOptions = {
  countdownSeconds?: number;
  force?: boolean;
};

export async function warnBeforeOpenAiCalls(options: WarnBeforeOpenAiCallsOptions = {}) {
  const countdownSeconds = options.countdownSeconds ?? 5;
  if (options.force) return;

  console.log('');
  console.log('WARNING: This script will call the OpenAI API and may incur usage costs.');
  console.log('Press Ctrl+C now if you want to cancel.');
  for (let seconds = countdownSeconds; seconds >= 1; seconds -= 1) {
    console.log(`Starting in ${seconds}s...`);
    await delay(1000);
  }
  console.log('');
}
