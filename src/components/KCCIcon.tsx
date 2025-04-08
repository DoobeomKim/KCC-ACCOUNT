import { SVGProps } from 'react'

export default function KCCIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="24" height="24" rx="4" fill="#000000" />
      <rect x="6" y="14" width="3" height="6" fill="white" />
      <rect x="11" y="8" width="3" height="12" fill="white" />
      <rect x="16" y="4" width="3" height="16" fill="white" />
    </svg>
  )
} 