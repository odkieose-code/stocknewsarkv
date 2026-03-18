import { useQuery } from '@tanstack/react-query'
import { fetchSectors } from '../utils/api'

interface SectorFilterProps {
  selected?: string
  onSelect: (sector: string | undefined) => void
}

export default function SectorFilter({ selected, onSelect }: SectorFilterProps) {
  const { data: sectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: fetchSectors,
  })

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(undefined)}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
          !selected
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        전체
      </button>
      {sectors?.map((s) => (
        <button
          key={s.sector}
          onClick={() => onSelect(s.sector)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            selected === s.sector
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {s.sector}
          <span className="ml-1 text-xs opacity-60">{s.count}</span>
        </button>
      ))}
    </div>
  )
}
