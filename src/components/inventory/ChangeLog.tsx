"use client";

interface ChangeLogProps {
  changeLog: string[];
}

export const ChangeLog: React.FC<ChangeLogProps> = ({ changeLog }) => {
  return (
    <div className="overflow-y-auto max-h-64">
      <ul className="list-none p-0">
        {changeLog.map((log, index) => (
          <li key={index} className="py-2 border-b border-gray-200">
            {log}
          </li>
        ))}
      </ul>
    </div>
  );
};
