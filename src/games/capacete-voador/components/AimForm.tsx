import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ANGLE_MAX, ANGLE_MIN, VELOCITY_MAX, VELOCITY_MIN } from '../game/constants';
import type { Shot } from '../game/types';

interface Props {
  initial: Shot | null;
  onFire: (shot: Shot) => void;
}

export function AimForm({ initial, onFire }: Props) {
  const [angle, setAngle] = useState(String(initial?.angle ?? 45));
  const [velocity, setVelocity] = useState(String(initial?.velocity ?? 50));
  const [error, setError] = useState<string | null>(null);
  const angleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    angleRef.current?.focus();
    angleRef.current?.select();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = Number(angle);
    const v = Number(velocity);
    if (!Number.isFinite(a) || a < ANGLE_MIN || a > ANGLE_MAX) {
      setError(`Ângulo entre ${ANGLE_MIN} e ${ANGLE_MAX}`);
      return;
    }
    if (!Number.isFinite(v) || v < VELOCITY_MIN || v > VELOCITY_MAX) {
      setError(`Velocidade entre ${VELOCITY_MIN} e ${VELOCITY_MAX}`);
      return;
    }
    onFire({ angle: a, velocity: v });
  };

  return (
    <form className="aim-form" onSubmit={submit}>
      <label>
        <span>Ângulo</span>
        <input
          ref={angleRef}
          type="number"
          inputMode="decimal"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
        />
      </label>
      <label>
        <span>Velocidade</span>
        <input
          type="number"
          inputMode="decimal"
          min={VELOCITY_MIN}
          max={VELOCITY_MAX}
          value={velocity}
          onChange={(e) => setVelocity(e.target.value)}
        />
      </label>
      <button type="submit">Lançar!</button>
      {error && (
        <p className="aim-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
