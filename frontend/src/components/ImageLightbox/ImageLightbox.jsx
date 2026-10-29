import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ImageLightbox.css';

function Icon({ children }) {
  return <span className="material-symbols-outlined">{children}</span>;
}

function ImageLightbox({ image, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const viewerRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  function setZoom(scale) {
    const nextScale = Math.min(4, Math.max(1, scale));
    setView((current) => ({
      scale: nextScale,
      x: nextScale === 1 ? 0 : current.x,
      y: nextScale === 1 ? 0 : current.y,
    }));
  }

  function handleWheel(event) {
    event.preventDefault();
    setZoom(view.scale + (event.deltaY < 0 ? 0.2 : -0.2));
  }

  function handlePointerDown(event) {
    if (view.scale <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...view };
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const bounds = viewerRef.current?.getBoundingClientRect();
    const maxX = bounds ? (bounds.width * (view.scale - 1)) / 2 + 48 : Infinity;
    const maxY = bounds ? (bounds.height * (view.scale - 1)) / 2 + 48 : Infinity;
    const nextX = dragRef.current.x + event.clientX - dragRef.current.pointerX;
    const nextY = dragRef.current.y + event.clientY - dragRef.current.pointerY;

    setView((current) => ({
      ...current,
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    }));
  }

  function stopDragging() {
    dragRef.current = null;
    setIsDragging(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="image-lightbox"
      aria-label={`Pratinjau gambar: ${image.name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="image-lightbox-header">
        <div className="image-lightbox-file">
          <Icon>image</Icon>
          <span title={image.name}>{image.name}</span>
        </div>
        <div className="image-lightbox-tools" aria-label="Kontrol gambar">
          <button
            type="button"
            aria-label="Perkecil gambar"
            title="Perkecil"
            disabled={view.scale <= 1}
            onClick={() => setZoom(view.scale - 0.5)}
          >
            <Icon>remove</Icon>
          </button>
          <button
            className="image-lightbox-zoom-level"
            type="button"
            aria-label="Atur ulang zoom"
            title="Atur ulang"
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            aria-label="Perbesar gambar"
            title="Perbesar"
            disabled={view.scale >= 4}
            onClick={() => setZoom(view.scale + 0.5)}
          >
            <Icon>add</Icon>
          </button>
        </div>
        <button
          ref={closeButtonRef}
          className="image-lightbox-close"
          type="button"
          aria-label="Tutup pratinjau gambar"
          title="Tutup"
          onClick={onClose}
        >
          <Icon>close</Icon>
        </button>
      </header>
      <div
        ref={viewerRef}
        className={`image-lightbox-content${isDragging ? ' is-dragging' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
      >
        <img
          src={image.url}
          alt={image.name}
          draggable="false"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
        {image.caption && <p>{image.caption}</p>}
      </div>
      <p className="image-lightbox-hint">
        Scroll untuk zoom · Seret untuk menggeser · Klik persentase untuk reset
      </p>
    </dialog>,
    document.body,
  );
}

export default ImageLightbox;
