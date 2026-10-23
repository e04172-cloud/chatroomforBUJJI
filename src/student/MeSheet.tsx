import { useState } from 'react';
import { setIngredient, logout } from '../data/students';
import { IngredientGrid } from '../components/IngredientGrid';
import { Sheet } from '../components/Sheet';
import { useShell } from './shell';

/** Change my ingredient, go back to the room list, or sign out. */
export function MeSheet({ open, onClose, onLobby }: { open: boolean; onClose: () => void; onLobby?: () => void }) {
  const { student } = useShell();
  const [error, setError] = useState<string | null>(null);

  async function change(key: string) {
    setError(null);
    try {
      await setIngredient(key);
    } catch {
      setError('재료를 바꾸지 못했어요. 잠시 후 다시 해 보세요.');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${student.name}의 재료`}>
      <IngredientGrid value={student.ingredient} onChange={(k) => void change(k)} />
      {error && <p className="err" role="alert">{error}</p>}
      <p className="note">바꾼 재료는 다음 메시지부터 보여요.</p>
      {onLobby && <button type="button" className="btn secondary" onClick={onLobby}>🍲 냄비 목록으로</button>}
      <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={() => void logout()}>나가기</button>
    </Sheet>
  );
}
