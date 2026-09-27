export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="eye-glyph">
      <path
        d="M4 24C10 12 18 7 24 7C30 7 38 12 44 24C38 36 30 41 24 41C18 41 10 36 4 24Z"
        stroke="#e3b341"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="8.5" stroke="#e3b341" strokeWidth="2.4" />
      <path d="M24 19L26 23.2L24 29L22 23.2L24 19Z" fill="#e3b341" />
      <circle cx="24" cy="24" r="1.6" fill="#06070d" />
    </svg>
  );
}
