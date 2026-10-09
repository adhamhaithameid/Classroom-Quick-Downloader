import { POPUP_STATES } from '../fixtures/states';

/** Route "/" — placeholder; the full state map lands in its own commit. */
export function MapRoute() {
  return (
    <div className="sim-map">
      <h1>CQD Simulator</h1>
      <p>The full state map is being built. Popup states available now:</p>
      <ul>
        {POPUP_STATES.map((state) => (
          <li key={state.id}>
            <a href={`#popup=${state.id}`}>{state.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
