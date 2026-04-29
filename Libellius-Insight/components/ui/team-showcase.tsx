import { useMemo, useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TeamShowcaseMember {
  id: string;
  name: string;
  role: string;
  image?: string;
}

interface TeamShowcaseProps {
  members: TeamShowcaseMember[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1542206395-9feb3edaa68d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1614289371518-722f2615943d?auto=format&fit=crop&w=600&q=80',
];

const resolveImage = (member: TeamShowcaseMember, index: number) =>
  member.image || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length];

export default function TeamShowcase({
  members,
  selectedId,
  onSelect,
}: TeamShowcaseProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeId = hoveredId || selectedId || null;

  const col1 = members.filter((_, i) => i % 3 === 0);
  const col2 = members.filter((_, i) => i % 3 === 1);
  const col3 = members.filter((_, i) => i % 3 === 2);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  if (!members.length) {
    return (
      <div className="rounded-[2rem] border border-black/5 bg-white p-8 text-center">
        <p className="text-sm font-bold text-black/50">Nie sú dostupní manažéri.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[2rem] border border-black/5 bg-white p-5 md:p-6 shadow-2xl shadow-black/5">
      <div className="flex items-center gap-2 mb-4">
        <UserCircle2 className="w-4 h-4 text-brand" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45">
          Výber manažéra
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-7 md:gap-8 select-none w-full">
        <div className="flex gap-2 md:gap-3 flex-shrink-0 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <div className="flex flex-col gap-2 md:gap-3">
            {col1.map((member) => (
              <PhotoCard
                key={member.id}
                member={member}
                className="w-[106px] h-[116px] sm:w-[128px] sm:h-[138px] md:w-[148px] md:h-[158px]"
                activeId={activeId}
                onHover={setHoveredId}
                onSelect={onSelect}
                image={resolveImage(member, members.findIndex((m) => m.id === member.id))}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 md:gap-3 mt-[46px] sm:mt-[56px] md:mt-[64px]">
            {col2.map((member) => (
              <PhotoCard
                key={member.id}
                member={member}
                className="w-[118px] h-[128px] sm:w-[142px] sm:h-[152px] md:w-[164px] md:h-[174px]"
                activeId={activeId}
                onHover={setHoveredId}
                onSelect={onSelect}
                image={resolveImage(member, members.findIndex((m) => m.id === member.id))}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 md:gap-3 mt-[20px] sm:mt-[24px] md:mt-[30px]">
            {col3.map((member) => (
              <PhotoCard
                key={member.id}
                member={member}
                className="w-[110px] h-[120px] sm:w-[132px] sm:h-[142px] md:w-[154px] md:h-[164px]"
                activeId={activeId}
                onHover={setHoveredId}
                onSelect={onSelect}
                image={resolveImage(member, members.findIndex((m) => m.id === member.id))}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:grid sm:grid-cols-2 md:flex md:flex-col gap-3.5 md:gap-4 flex-1 w-full">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isActive={activeId === member.id}
              isDimmed={activeId !== null && activeId !== member.id}
              onHover={setHoveredId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {selectedId && membersById.get(selectedId) && (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">
            Aktívny manažér
          </p>
          <p className="text-sm font-black mt-1">{membersById.get(selectedId)?.name}</p>
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  member,
  image,
  className,
  activeId,
  onHover,
  onSelect,
}: {
  member: TeamShowcaseMember;
  image: string;
  className: string;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  const isActive = activeId === member.id;
  const isDimmed = activeId !== null && !isActive;

  return (
    <button
      type="button"
      className={cn(
        'overflow-hidden rounded-xl cursor-pointer flex-shrink-0 transition-opacity duration-300 border border-black/10',
        className,
        isDimmed ? 'opacity-50' : 'opacity-100'
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect?.(member.id)}
    >
      <img
        src={image}
        alt={member.name}
        className="w-full h-full object-cover transition-[filter,transform] duration-500"
        style={{
          filter: isActive ? 'grayscale(0) brightness(1)' : 'grayscale(1) brightness(0.72)',
          transform: isActive ? 'scale(1.02)' : 'scale(1)',
        }}
      />
    </button>
  );
}

function MemberRow({
  member,
  isActive,
  isDimmed,
  onHover,
  onSelect,
}: {
  member: TeamShowcaseMember;
  isActive: boolean;
  isDimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'text-left cursor-pointer transition-opacity duration-300',
        isDimmed ? 'opacity-50' : 'opacity-100'
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect?.(member.id)}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-4 h-3 rounded-[5px] flex-shrink-0 transition-all duration-300',
            isActive ? 'bg-brand w-6' : 'bg-black/20'
          )}
        />
        <span
          className={cn(
            'text-base md:text-[18px] font-semibold leading-none tracking-tight transition-colors duration-300',
            isActive ? 'text-black' : 'text-black/75'
          )}
        >
          {member.name}
        </span>
      </div>
      <p className="mt-1.5 pl-[27px] text-[9px] md:text-[10px] font-medium uppercase tracking-[0.18em] text-black/45">
        {member.role}
      </p>
    </button>
  );
}
