import { useEffect, useRef } from 'react'

/**
 * Coordinates React `isOpen` state with a native `<dialog>` element opened via `showModal()`.
 * Includes the `closedby="any"` pointer-bounds fallback for browsers without native `closedBy` (e.g. Safari),
 * requiring both `pointerdown` and `pointerup` outside the dialog box so text-selection drags never dismiss it.
 */
export function useModalDialog(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ''
      onClose()
    }

    dialog.addEventListener('close', handleClose)

    // Progressive-enhancement light-dismiss fallback when `closedBy` is unsupported
    const supportsClosedBy =
      typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype

    let cleanupPointerFallback: (() => void) | undefined
    if (!supportsClosedBy) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect()
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
      }
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e)
      }
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close()
        }
        pressedOutside = false
      }
      dialog.addEventListener('pointerdown', onPointerDown)
      dialog.addEventListener('pointerup', onPointerUp)
      cleanupPointerFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown)
        dialog.removeEventListener('pointerup', onPointerUp)
      }
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      cleanupPointerFallback?.()
    }
  }, [onClose])

  return dialogRef
}
