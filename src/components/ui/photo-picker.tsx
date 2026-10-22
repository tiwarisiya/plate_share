"use client";

import React, { useEffect, useId, useMemo, useState } from "react";

type PhotoPickerProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  // Rendered next to the thumbnail once a photo is chosen (e.g. the Scan
  // button).
  children?: React.ReactNode;
};

// A large "Add a photo" tile instead of the browser's bare "Choose file"
// input: click to browse, drop a photo on it (desktop), or take one with
// the camera (phones). Shows a thumbnail with Change / Remove once chosen.
export function PhotoPicker({ file, onChange, label = "📷 Add a photo", children }: PhotoPickerProps) {
  const id = useId();
  const cameraId = `${id}-camera`;
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] || null);
    e.target.value = "";
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (dropped) onChange(dropped);
  };

  const inputs = (
    <>
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={pick} />
      <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
    </>
  );

  if (file && previewUrl) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {inputs}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Chosen photo" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-600">{file.name}</p>
          <div className="mt-1 flex gap-3 text-sm">
            <label htmlFor={id} className="cursor-pointer font-medium text-emerald-800 hover:underline">Change</label>
            <button type="button" className="font-medium text-rose-700 hover:underline" onClick={() => onChange(null)}>Remove</button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div>
      {inputs}
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/50"
        }`}
      >
        <span className="text-base font-semibold text-slate-900">{label}</span>
        <span className="text-xs text-slate-500">
          Take a photo or choose one from your device
          <span className="hidden md:inline"> — or drop it here</span>
        </span>
      </label>
      <label htmlFor={cameraId} className="mt-2 flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 md:hidden">
        Use camera
      </label>
    </div>
  );
}
