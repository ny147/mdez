export function Mascot({ label = "Mdez mascot" }: { label?: string }) {
  return (
    <div aria-label={label} role="img" className="mx-auto h-20 w-20 rounded-[2rem] border-4 border-white bg-bubble p-2 shadow-sticker">
      <div className="relative h-full w-full rounded-[1.5rem] bg-cream">
        <span className="absolute left-4 top-7 h-2.5 w-2.5 rounded-full bg-abyss" />
        <span className="absolute right-4 top-7 h-2.5 w-2.5 rounded-full bg-abyss" />
        <span className="absolute left-1/2 top-10 h-2 w-3 -translate-x-1/2 rounded-full bg-bubble" />
        <span className="absolute left-3 top-2 h-4 w-4 rotate-45 rounded-sm bg-cream" />
        <span className="absolute right-3 top-2 h-4 w-4 rotate-45 rounded-sm bg-cream" />
      </div>
    </div>
  );
}
