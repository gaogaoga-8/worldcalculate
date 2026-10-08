export function Galaxy({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="formation-controls">
      <span className="sr-only" role="status">
        群星正在散开，本命星正在显现。
      </span>
      <button
        className="formation-skip"
        onClick={onSkip}
        aria-label="跳过生成动画"
      >
        跳过
      </button>
    </div>
  );
}
