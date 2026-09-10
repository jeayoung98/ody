"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/common/button";
import TextInput from "@/components/common/text-input";
import { useCreatePlaylistMutation } from "@/hooks/mutations/use-create-playlist-mutation";
import type { PlaylistDetail } from "@/types";

interface CreatePlaylistFormProps {
  onCreated?: (playlist: PlaylistDetail) => void;
}

/** 새 플레이리스트 생성 (PATH-03) */
export default function CreatePlaylistForm({ onCreated }: CreatePlaylistFormProps) {
  const [name, setName] = useState("");
  const create = useCreatePlaylistMutation();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (p) => {
        setName("");
        onCreated?.(p);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <TextInput placeholder="새 플레이리스트 이름" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || create.isPending}>
        만들기
      </Button>
    </form>
  );
}
