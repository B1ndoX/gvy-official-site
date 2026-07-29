import { Icon } from "../icons.jsx";

const labels = [
  "保留原图",
  "生成 1280 WebP",
  "按原图宽度生成 1920 WebP",
  "生成 640×360 缩略图",
  "更新相册与最新批次标记",
  "运行完整测试与生产构建",
];

const stateLabel = { pending: "待执行", running: "处理中", done: "完成", error: "失败" };

export function CheckRail({ operation }) {
  const steps = operation?.steps || labels.map(() => "pending");
  return (
    <aside className="check-rail">
      <h2>发布检查</h2>
      <div className="check-list">
        {labels.map((label, index) => {
          const rawState = steps[index] || "pending";
          const state = operation?.status === "idle" && index === 0 ? "ready" : rawState;
          return (
            <div className={`check-row is-${state}`} key={label}>
              <span className="step-number">{index + 1}</span>
              <div><strong>{label}</strong>{index === 2 ? <small>仅原图宽度足够时生成</small> : null}</div>
              <span className="step-status">{state === "ready" ? "就绪" : stateLabel[rawState]}{rawState === "done" ? <Icon name="check" size={16} /> : null}</span>
            </div>
          );
        })}
      </div>
      {operation?.status === "done" ? <p className="build-complete"><Icon name="check" size={17} />生产构建完成</p> : null}
      {operation?.status === "error" ? <p className="build-error">{operation.message}</p> : null}
    </aside>
  );
}
