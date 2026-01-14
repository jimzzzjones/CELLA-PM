import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task, ProposedChange, ViewMode } from '../types';

interface GanttChartProps {
  tasks: Task[];
  proposedChanges: ProposedChange[];
  pendingNewTasks?: Task[];
  onTaskUpdate?: (task: Task) => void;
  onTaskReorder?: (tasks: Task[]) => void;
  onTaskDelete?: (taskId: string) => void;
  viewMode: ViewMode;
  readOnly?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onInsertTask?: (targetTaskId: string, position: 'before' | 'after') => void;
}

const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 56; // Defined row height for calculation

type SortOrder = 'default' | 'asc' | 'desc';

interface DragState {
  taskId: string;
  startX: number;
  initialLeft: number;
  currentLeft: number;
  originalStartDate: Date;
  originalEndDate: Date;
  mode: 'move' | 'resize-left' | 'resize-right';
}

const GanttChart: React.FC<GanttChartProps> = ({ 
    tasks, 
    proposedChanges, 
    pendingNewTasks = [], 
    onTaskUpdate, 
    onTaskReorder,
    onTaskDelete,
    viewMode,
    readOnly = false,
    onZoomIn,
    onZoomOut,
    onInsertTask
}) => {
  // State
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Responsive Sidebar Width
  const [sidebarWidth, setSidebarWidth] = useState(240);

  // Container Panning State (Mouse)
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartScrollLeft, setPanStartScrollLeft] = useState(0);

  // Container Touch State (Mobile)
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);

  // Task Dragging State
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<{ start: string; end: string } | null>(null);
  const [conflictDependencyId, setConflictDependencyId] = useState<string | null>(null);

  // Hover State for Dependencies
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Reordering State
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Edit/Delete State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Task>>({});
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Effect to handle window resize for sidebar width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarWidth(140); // Compact sidebar on mobile
      } else {
        setSidebarWidth(240); // Full sidebar on desktop
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Configuration for each view mode
  const VIEW_CONFIG = {
    Day: {
      pixelsPerDay: 48,
      headerFormat: (d: Date) => d.getDate().toString(),
      subHeaderFormat: (d: Date) => d.toLocaleDateString('zh-CN', { weekday: 'narrow' }),
    },
    Week: {
      pixelsPerDay: 16, // ~112px per week
      headerFormat: (d: Date) => {
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        return `${d.getMonth() + 1}/${d.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
      },
      subHeaderFormat: () => '',
    },
    Month: {
      pixelsPerDay: 5, // ~150px per month
      headerFormat: (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月`,
      subHeaderFormat: () => '',
    },
    Quarter: {
      pixelsPerDay: 1.5, // ~135px per quarter
      headerFormat: (d: Date) => {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `${d.getFullYear()} Q${q}`;
      },
      subHeaderFormat: () => '',
    }
  };

  const pixelsPerDay = VIEW_CONFIG[viewMode].pixelsPerDay;

  // Date Parsing Helper
  const parseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    return d;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Combine tasks for display
  const allTasks = useMemo(() => {
    return [...tasks, ...pendingNewTasks];
  }, [tasks, pendingNewTasks]);

  // Sorted Tasks
  const sortedTasks = useMemo(() => {
    if (sortOrder === 'default') return allTasks;
    return [...allTasks].sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [allTasks, sortOrder]);
  
  // Calculations
  const { minDate, totalWidth, ticks } = useMemo(() => {
    if (allTasks.length === 0) return { minDate: new Date(), totalWidth: 0, ticks: [] };
    
    // 1. Determine Min/Max dates from tasks
    let startDates = allTasks.map(t => parseDate(t.startDate).getTime());
    let endDates = allTasks.map(t => parseDate(t.endDate).getTime());

    proposedChanges.forEach(p => {
        startDates.push(parseDate(p.newStartDate).getTime());
        endDates.push(parseDate(p.newEndDate).getTime());
    });
    
    let min = new Date(Math.min(...startDates));
    let max = new Date(Math.max(...endDates));

    // 2. Pad range
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    // 3. Align Timeline Start based on View Mode
    const timelineStart = new Date(min);
    timelineStart.setHours(0,0,0,0);

    if (viewMode === 'Week') {
        const day = timelineStart.getDay();
        const diff = timelineStart.getDate() - day + (day === 0 ? -6 : 1); // Align to Monday
        timelineStart.setDate(diff);
    } else if (viewMode === 'Month') {
        timelineStart.setDate(1);
    } else if (viewMode === 'Quarter') {
        timelineStart.setDate(1);
        const qMonth = Math.floor(timelineStart.getMonth() / 3) * 3;
        timelineStart.setMonth(qMonth);
    }

    // 4. Generate Ticks
    const generatedTicks: Date[] = [];
    const iterator = new Date(timelineStart);
    const targetEnd = new Date(max);
    
    // Ensure we render enough ticks to cover the end date
    if (viewMode === 'Month' || viewMode === 'Quarter') {
        targetEnd.setDate(1);
        targetEnd.setMonth(targetEnd.getMonth() + 2); 
    } else {
        targetEnd.setDate(targetEnd.getDate() + 14);
    }

    while (iterator <= targetEnd) {
        generatedTicks.push(new Date(iterator));
        
        // Step forward
        if (viewMode === 'Day') iterator.setDate(iterator.getDate() + 1);
        else if (viewMode === 'Week') iterator.setDate(iterator.getDate() + 7);
        else if (viewMode === 'Month') iterator.setMonth(iterator.getMonth() + 1);
        else if (viewMode === 'Quarter') iterator.setMonth(iterator.getMonth() + 3);
    }

    // 5. Calculate Total Width
    const lastTick = generatedTicks[generatedTicks.length - 1];
    const totalDays = (lastTick.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const width = totalDays * VIEW_CONFIG[viewMode].pixelsPerDay;

    return { minDate: timelineStart, totalWidth: width, ticks: generatedTicks };
  }, [allTasks, proposedChanges, viewMode]);

  // Position Helpers
  const getX = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? parseDate(dateStr) : dateStr;
    const diffTime = date.getTime() - minDate.getTime();
    const days = diffTime / (1000 * 60 * 60 * 24);
    return days * pixelsPerDay;
  };

  const getWidth = (startStr: string, endStr: string) => {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
    return days * pixelsPerDay;
  };

  // --- Dependency Visualization Logic ---
  const { dependencyLines, relatedTaskIds } = useMemo(() => {
    if (!hoveredTaskId) return { dependencyLines: [], relatedTaskIds: new Set<string>() };

    const lines: React.ReactElement[] = [];
    const relatedIds = new Set<string>();
    
    // Create a map for quick task index lookup
    const taskIndexMap = new Map<string, number>();
    sortedTasks.forEach((t, i) => taskIndexMap.set(t.id, i));

    const currentTask = sortedTasks.find(t => t.id === hoveredTaskId);
    if (!currentTask) return { dependencyLines: [], relatedTaskIds: new Set() };

    relatedIds.add(currentTask.id);

    // 1. Draw lines from Predecessors -> Current
    currentTask.dependencies.forEach(depId => {
        const depTask = sortedTasks.find(t => t.id === depId);
        const depIndex = taskIndexMap.get(depId);
        const currentIndex = taskIndexMap.get(currentTask.id);

        if (depTask && depIndex !== undefined && currentIndex !== undefined) {
            relatedIds.add(depId);

            // Correct StartX: Position + Width. Note: using startDate for position base.
            const startX = getX(depTask.startDate) + getWidth(depTask.startDate, depTask.endDate);
            const startY = (depIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
            
            const endX = getX(currentTask.startDate);
            const endY = (currentIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);

            // Draw Curve
            const controlPointOffset = 20;
            const path = `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;
            
            lines.push(
                <path 
                    key={`dep-${depId}-${currentTask.id}`} 
                    d={path} 
                    stroke="#6366F1" // Indigo 500
                    strokeWidth="2" 
                    fill="none" 
                    markerEnd="url(#arrowhead)"
                />
            );
        }
    });

    // 2. Draw lines from Current -> Successors
    sortedTasks.forEach((t, index) => {
        if (t.dependencies.includes(currentTask.id)) {
            relatedIds.add(t.id);
            
            const currentIndex = taskIndexMap.get(currentTask.id);
            if (currentIndex !== undefined) {
                // Correct StartX: Position + Width. Note: using startDate for position base.
                const startX = getX(currentTask.startDate) + getWidth(currentTask.startDate, currentTask.endDate);
                const startY = (currentIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                const endX = getX(t.startDate);
                const endY = (index * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                const controlPointOffset = 20;
                const path = `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;

                lines.push(
                    <path 
                        key={`dep-${currentTask.id}-${t.id}`} 
                        d={path} 
                        stroke="#F59E0B" // Amber 500
                        strokeWidth="2" 
                        fill="none" 
                        markerEnd="url(#arrowhead-amber)"
                    />
                );
            }
        }
    });

    return { dependencyLines: lines, relatedTaskIds: relatedIds };
  }, [hoveredTaskId, sortedTasks, minDate, pixelsPerDay, sidebarWidth]); // Added sidebarWidth dependency


  // --- Sort Handler ---
  const toggleSort = () => {
    setSortOrder(current => {
      if (current === 'default') return 'asc';
      if (current === 'asc') return 'desc';
      return 'default';
    });
  };

  // --- Pan Handlers (Mouse) ---
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
    if (!containerRef.current) return;
    setIsPanning(true);
    setPanStartX(e.pageX);
    setPanStartScrollLeft(containerRef.current.scrollLeft);
  };

  const handlePanMouseUp = () => setIsPanning(false);
  const handlePanMouseLeave = () => setIsPanning(false);

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current || dragState) return; // Don't pan if dragging a task
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - panStartX); 
    containerRef.current.scrollLeft = panStartScrollLeft - walk;
  };

  // --- Touch Handlers (Mobile Panning & Zooming) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    // Ignore input/button touches
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;

    if (e.touches.length === 1) {
      // Pan
      setIsPanning(true);
      setTouchStartX(e.touches[0].pageX);
      if (containerRef.current) {
        setPanStartScrollLeft(containerRef.current.scrollLeft);
      }
    } else if (e.touches.length === 2) {
      // Zoom
      setIsPanning(false); // Stop panning
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     if (!containerRef.current) return;
     
     if (e.touches.length === 1 && isPanning) {
        // Horizontal Pan
        const currentX = e.touches[0].pageX;
        const walk = currentX - touchStartX;
        containerRef.current.scrollLeft = panStartScrollLeft - walk;
        // NOTE: We do not preventDefault() here to allow vertical scrolling of the page
     } else if (e.touches.length === 2 && initialPinchDist) {
        // Pinch Zoom
        if (e.cancelable) e.preventDefault(); // Prevent browser zoom
        
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        const ratio = dist / initialPinchDist;
        
        // Thresholds for triggering zoom
        if (ratio > 1.3) {
            onZoomIn?.();
            setInitialPinchDist(dist); // Reset base distance
        } else if (ratio < 0.7) {
            onZoomOut?.();
            setInitialPinchDist(dist); // Reset base distance
        }
     }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setInitialPinchDist(null);
  };

  // --- Task Drag Handlers (Resize/Move) ---
  
  const handleTaskMouseDown = (e: React.MouseEvent, task: Task) => {
    if (readOnly) return; // Guard for Read Only

    e.stopPropagation(); // Stop panning
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Determine mode based on click position (Edges = Resize, Center = Move)
    // Only detect resize if pixelsPerDay is large enough (Day/Week view)
    let mode: 'move' | 'resize-left' | 'resize-right' = 'move';
    const edgeThreshold = 10;
    
    if (pixelsPerDay > 5) {
        if (clickX <= edgeThreshold) mode = 'resize-left';
        else if (clickX >= rect.width - edgeThreshold) mode = 'resize-right';
    }

    const initialLeft = getX(task.startDate);
    
    setDragState({
        taskId: task.id,
        startX: e.pageX,
        initialLeft: initialLeft,
        currentLeft: initialLeft,
        originalStartDate: parseDate(task.startDate),
        originalEndDate: parseDate(task.endDate),
        mode
    });
    setPreviewDates({ start: task.startDate, end: task.endDate });
  };

  // Add global listeners for drag move/end to handle mouse going outside container
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!dragState) return;

        const deltaX = e.pageX - dragState.startX;
        const daysShift = Math.round(deltaX / pixelsPerDay);
        
        let newStart = new Date(dragState.originalStartDate);
        let newEnd = new Date(dragState.originalEndDate);
        let currentLeft = dragState.initialLeft;

        // Calculate based on mode
        if (dragState.mode === 'move') {
            newStart.setDate(newStart.getDate() + daysShift);
            newEnd.setDate(newEnd.getDate() + daysShift);
            currentLeft = dragState.initialLeft + deltaX;
        } else if (dragState.mode === 'resize-left') {
            newStart.setDate(newStart.getDate() + daysShift);
            // Constraint: Start cannot be after End
            if (newStart > newEnd) newStart = new Date(newEnd);
            // Visual left only changes if we aren't blocked by end date
            if (newStart <= newEnd) currentLeft = dragState.initialLeft + (deltaX);
        } else if (dragState.mode === 'resize-right') {
            newEnd.setDate(newEnd.getDate() + daysShift);
            // Constraint: End cannot be before Start
            if (newEnd < newStart) newEnd = new Date(newStart);
        }

        // Update visual position state
        setDragState(prev => prev ? { ...prev, currentLeft: currentLeft } : null);

        const newStartStr = formatDate(newStart);
        const newEndStr = formatDate(newEnd);
        
        setPreviewDates({ start: newStartStr, end: newEndStr });

        // Check Conflicts
        const currentTask = allTasks.find(t => t.id === dragState.taskId);
        if (currentTask && currentTask.dependencies.length > 0) {
            let foundConflict = null;
            for (const depId of currentTask.dependencies) {
                const depTask = allTasks.find(t => t.id === depId);
                if (depTask) {
                    const depEnd = parseDate(depTask.endDate);
                    // If New Start <= Dependency End, Conflict!
                    if (newStart <= depEnd) {
                        foundConflict = depId;
                        break;
                    }
                }
            }
            setConflictDependencyId(foundConflict);
        }
    };

    const handleGlobalMouseUp = () => {
        if (!dragState) return;

        // Commit Changes
        if (onTaskUpdate && previewDates) {
            const currentTask = allTasks.find(t => t.id === dragState.taskId);
            if (currentTask) {
                // Check if actually changed
                if (currentTask.startDate !== previewDates.start || currentTask.endDate !== previewDates.end) {
                    onTaskUpdate({
                        ...currentTask,
                        startDate: previewDates.start,
                        endDate: previewDates.end
                    });
                }
            }
        }

        // Cleanup
        setDragState(null);
        setPreviewDates(null);
        setConflictDependencyId(null);
    };

    if (dragState) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        document.body.style.cursor = dragState.mode === 'move' ? 'grabbing' : 'ew-resize';
    } else {
        document.body.style.cursor = '';
    }

    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        document.body.style.cursor = '';
    };
  }, [dragState, pixelsPerDay, allTasks, onTaskUpdate]);

  // --- Row Reordering Handlers (Sidebar) ---
  const handleRowDragStart = (e: React.DragEvent, index: number) => {
    if (readOnly || sortOrder !== 'default') return; // Disable reordering if readOnly or sorted
    setDraggedTaskIndex(index);
    // Required for Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleRowDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Allow dropping
    if (readOnly || draggedTaskIndex === null || draggedTaskIndex === index || sortOrder !== 'default') return;
    setDragOverIndex(index);
  };

  const handleRowDrop = (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedTaskIndex !== null && dragOverIndex !== null && onTaskReorder && sortOrder === 'default' && !readOnly) {
          const newTasks = [...allTasks];
          const [movedTask] = newTasks.splice(draggedTaskIndex, 1);
          newTasks.splice(dragOverIndex, 0, movedTask);
          onTaskReorder(newTasks.filter(t => !t.isNew)); // Only reorder existing tasks for now
      }
      setDraggedTaskIndex(null);
      setDragOverIndex(null);
  };


  // --- Edit/Delete Handlers ---
  const startEditing = (task: Task) => {
    if (readOnly) return;
    setEditingTaskId(task.id);
    setEditValues({
      name: task.name,
      assignee: task.assignee,
      startDate: task.startDate,
      endDate: task.endDate,
      dependencies: task.dependencies ? [...task.dependencies] : []
    });
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditValues({});
  };

  const saveEditing = () => {
    if (editingTaskId && onTaskUpdate) {
      const originalTask = allTasks.find(t => t.id === editingTaskId);
      if (originalTask) {
        onTaskUpdate({
          ...originalTask,
          ...editValues as any 
        });
      }
    }
    setEditingTaskId(null);
    setEditValues({});
  };

  const handleInputChange = (field: keyof Task, value: any) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  // Delete Confirm Logic
  const confirmDelete = () => {
      if (deletingTask && onTaskDelete) {
          onTaskDelete(deletingTask.id);
      }
      setDeletingTask(null);
  };


  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden relative group font-roboto">
      
      {/* Chart Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto gantt-scroll relative select-none min-h-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'pan-y' }} // Allow vertical scroll, handle horizontal manually
        onMouseDown={handlePanMouseDown}
        onMouseUp={handlePanMouseUp}
        onMouseLeave={handlePanMouseLeave}
        onMouseMove={handlePanMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Increased bottom padding to prevent content from being hidden behind floating controls */}
        <div style={{ width: sidebarWidth + totalWidth, minWidth: '100%' }} className="pb-48">
            
            {/* Header Row */}
            {/* Increased Z-Index to 40 to sit above Sidebar Rows (30) but below Corner (50) */}
            <div className="flex sticky top-0 z-40 bg-[#F8F9FA] border-b border-[#E0E2E5]" style={{ height: HEADER_HEIGHT }}>
                {/* Sortable Task Name Header - Highest Z-Index (50) to float above everything */}
                <div 
                  className="sticky left-0 z-50 bg-[#F8F9FA] border-r border-[#E0E2E5] flex items-center justify-between px-3 md:px-6 font-medium text-[#444746] text-xs md:text-sm shadow-[4px_0_8px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-[#EEF2FF] hover:text-indigo-600 transition-colors group/header" 
                  style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                  onClick={toggleSort}
                  title={`按开始时间${sortOrder === 'asc' ? '升序' : sortOrder === 'desc' ? '降序' : '排序'}`}
                >
                    <span>任务名称</span>
                    <div className="flex items-center text-[#5F6368] group-hover/header:text-indigo-600 transition-colors">
                        {sortOrder === 'default' && <span className="material-symbols-outlined text-base md:text-lg opacity-30">sort</span>}
                        {sortOrder === 'asc' && <span className="material-symbols-outlined text-base md:text-lg">arrow_upward</span>}
                        {sortOrder === 'desc' && <span className="material-symbols-outlined text-base md:text-lg">arrow_downward</span>}
                    </div>
                </div>
                <div className="flex relative h-full">
                    {ticks.slice(0, ticks.length - 1).map((tick, i) => {
                        const nextTick = ticks[i+1];
                        const colWidth = getX(nextTick) - getX(tick);
                        
                        return (
                            <div 
                                key={i} 
                                className="flex flex-col items-center justify-center border-r border-[#E0E2E5] text-xs text-[#5F6368] h-full" 
                                style={{ width: colWidth }}
                            >
                                <span className={`font-medium ${tick.getDay() === 0 || tick.getDay() === 6 ? 'text-[#9AA0A6]' : ''}`}>
                                    {VIEW_CONFIG[viewMode].headerFormat(tick)}
                                </span>
                                {VIEW_CONFIG[viewMode].subHeaderFormat(tick) && (
                                    <span className="text-[10px] uppercase tracking-wide opacity-70 mt-0.5">
                                        {VIEW_CONFIG[viewMode].subHeaderFormat(tick)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Task Rows */}
            <div className="relative">
                {/* Grid Lines - Lowest Z-Index (0) */}
                <div className="absolute inset-0 flex pointer-events-none h-full z-0" style={{ paddingLeft: sidebarWidth }}>
                     {ticks.slice(0, ticks.length - 1).map((tick, i) => {
                         const nextTick = ticks[i+1];
                         const colWidth = getX(nextTick) - getX(tick);
                         return (
                            <div 
                                key={i} 
                                className={`h-full border-r border-[#F1F3F4]`} 
                                style={{ width: colWidth }}
                            ></div>
                         );
                     })}
                </div>

                {/* SVG Layer for Dependency Lines - Z-Index 10 */}
                <svg className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: sidebarWidth, width: totalWidth, height: '100%' }}>
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#6366F1" />
                        </marker>
                        <marker id="arrowhead-amber" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                        </marker>
                    </defs>
                    {dependencyLines}
                </svg>

                {sortedTasks.map((task, index) => {
                    const proposed = proposedChanges.find(p => p.taskId === task.id);
                    const isChanging = !!proposed;
                    const isNew = !!task.isNew;
                    const isEditing = editingTaskId === task.id;
                    const isDraggingThis = dragState?.taskId === task.id;
                    const isConflictDependency = conflictDependencyId === task.id;
                    
                    // Hover State Logic
                    const isHovered = hoveredTaskId === task.id;
                    const isRelated = relatedTaskIds.has(task.id);
                    const shouldDim = hoveredTaskId !== null && !isRelated;

                    // Calculate position (Dynamic if dragging)
                    const taskLeft = isDraggingThis ? dragState.currentLeft : getX(task.startDate);
                    let taskWidth = getWidth(task.startDate, task.endDate);
                    
                    // If resizing right, we need to adjust visual width based on mouse
                    if (isDraggingThis && dragState.mode === 'resize-right') {
                         const draggedDateWidth = getWidth(previewDates?.start!, previewDates?.end!);
                         taskWidth = draggedDateWidth;
                    }
                    // If resizing left, the width is also affected
                    if (isDraggingThis && dragState.mode === 'resize-left') {
                         const draggedDateWidth = getWidth(previewDates?.start!, previewDates?.end!);
                         taskWidth = draggedDateWidth;
                    }

                    return (
                        <div 
                            key={task.id} 
                            className={`flex border-b border-[#F1F3F4] transition-all duration-200 relative group/row 
                                ${isNew ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-[#F8F9FA]'}
                                ${dragOverIndex === index ? 'border-b-2 border-b-indigo-500 bg-indigo-50' : ''}
                                ${draggedTaskIndex === index ? 'opacity-50' : ''}
                                ${shouldDim ? 'opacity-30 blur-[0.5px] grayscale' : 'opacity-100'}
                            `}
                            style={{ height: ROW_HEIGHT }}
                        >
                            {/* Sticky Sidebar Cell */}
                            {/* Z-Index increased to 30 to sit above chart content (20) but below header (40) */}
                            <div 
                              className={`sticky left-0 bg-white/85 backdrop-blur-sm group-hover/row:bg-[#F8F9FA]/85 border-r border-[#E0E2E5] flex flex-col justify-center px-3 md:px-6 shadow-[4px_0_8px_rgba(0,0,0,0.02)] transition-colors ${isEditing ? 'z-50' : 'z-30'} ${isNew ? '!bg-indigo-50/85' : ''}`} 
                              style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                              draggable={!isNew && !readOnly && sortOrder === 'default'}
                              onDragStart={(e) => handleRowDragStart(e, index)}
                              onDragOver={(e) => handleRowDragOver(e, index)}
                              onDrop={handleRowDrop}
                              onMouseDown={(e) => e.stopPropagation()} // Allow editing inputs to work
                            >
                                <div className="flex items-center justify-between w-full group-hover/row:translate-x-1 transition-transform">
                                  <div className="flex items-center gap-1 md:gap-2 min-w-0">
                                      {/* Drag Handle (Only visible when hovering, not sorting, and not readOnly) */}
                                      {!isNew && !readOnly && sortOrder === 'default' && (
                                        <span 
                                            className="material-symbols-outlined text-[#9AA0A6] text-sm md:text-base cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 hover:text-[#5F6368] transition-opacity shrink-0 hidden md:block" 
                                            title="Drag to reorder"
                                        >
                                            drag_indicator
                                        </span>
                                      )}
                                      
                                      {isNew && (
                                          <span className="material-symbols-outlined text-[14px] md:text-[16px] text-indigo-600 animate-pulse shrink-0">auto_awesome</span>
                                      )}
                                      <div className={`text-xs md:text-sm font-medium line-clamp-2 leading-tight whitespace-normal break-words ${isNew ? 'text-indigo-700' : 'text-[#1F1F1F]'}`} title={task.name}>{task.name}</div>
                                  </div>
                                  
                                  {/* Actions: Edit & Delete (Disabled for new tasks pending confirmation and readOnly mode) */}
                                  {!isNew && !readOnly && (
                                      <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 bg-white/90 rounded-full px-1 backdrop-blur-sm transition-opacity ml-auto mr-2 shadow-sm border border-gray-100 hidden md:flex">
                                          <button 
                                            onClick={() => onInsertTask?.(task.id, 'before')}
                                            className="p-1 hover:bg-[#E0E2E5] rounded-full transition-all text-[#5F6368]"
                                            title="在上方插入任务"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                                          </button>
                                          <button 
                                            onClick={() => onInsertTask?.(task.id, 'after')}
                                            className="p-1 hover:bg-[#E0E2E5] rounded-full transition-all text-[#5F6368]"
                                            title="在下方插入任务"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                                          </button>
                                          <div className="w-px h-3 bg-gray-300 mx-1"></div>
                                          <button 
                                            onClick={() => startEditing(task)}
                                            className="p-1 hover:bg-[#E0E2E5] rounded-full transition-all text-[#5F6368]"
                                            title="编辑"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                          </button>
                                          <button 
                                            onClick={() => setDeletingTask(task)}
                                            className="p-1 hover:bg-red-50 text-[#5F6368] hover:text-red-600 rounded-full transition-all"
                                            title="删除"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                          </button>
                                      </div>
                                  )}
                                  {/* Mobile Edit Trigger */}
                                  {!isNew && !readOnly && (
                                      <button 
                                        onClick={() => startEditing(task)}
                                        className="md:hidden text-[#9AA0A6]"
                                      >
                                          <span className="material-symbols-outlined text-[16px]">more_vert</span>
                                      </button>
                                  )}
                                </div>
                                <div className="flex items-center mt-1 pl-0 md:pl-6">
                                    <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold mr-1 md:mr-2 ${isNew ? 'bg-white text-indigo-600 border border-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {task.assignee.charAt(0)}
                                    </div>
                                    <div className={`text-[10px] md:text-xs ${isNew ? 'text-indigo-500' : 'text-[#5F6368]'}`}>{task.assignee}</div>
                                </div>
                            </div>

                            {/* Gantt Bar Area - Z-Index 20 */}
                            <div className="relative flex-1 h-full flex items-center z-20">
                                {/* Current Task Bar */}
                                <div 
                                    onMouseDown={(e) => !isNew && !isEditing && handleTaskMouseDown(e, task)}
                                    onMouseEnter={() => setHoveredTaskId(task.id)}
                                    onMouseLeave={() => setHoveredTaskId(null)}
                                    className={`absolute h-6 md:h-8 rounded-full shadow-sm border text-[10px] md:text-xs flex items-center px-2 md:px-3 truncate transition-all duration-150 select-none group/bar
                                        ${isDraggingThis && dragState.mode === 'move' ? 'cursor-grabbing shadow-lg scale-[1.02] ring-2 ring-offset-2' : ''}
                                        ${!isDraggingThis && !readOnly ? 'cursor-grab' : 'cursor-default'}
                                        ${isDraggingThis && dragState.mode.startsWith('resize') ? 'cursor-ew-resize ring-2 ring-indigo-500 ring-offset-1' : ''}
                                        ${isDraggingThis && conflictDependencyId ? 'ring-red-500 bg-red-100 border-red-300 text-red-800' : ''}
                                        ${isDraggingThis && !conflictDependencyId ? 'ring-indigo-500 z-50' : ''}
                                        ${isConflictDependency ? 'ring-2 ring-red-500 ring-offset-1 animate-pulse' : ''}
                                        ${isChanging || isEditing ? 'opacity-40 grayscale' : ''}
                                        ${isNew ? 'bg-indigo-100 border-indigo-300 text-indigo-800 border-dashed animate-pulse cursor-default' : ''}
                                        ${!isNew && !isDraggingThis && task.gmpCritical 
                                            ? 'bg-[#C4EED0] border-[#6DD58C] text-[#0A3816]' 
                                            : !isNew && !isDraggingThis && 'bg-[#D3E3FD] border-[#A8C7FA] text-[#041E49]'}
                                        ${isHovered ? 'ring-2 ring-indigo-500 ring-offset-1 z-30 scale-[1.01]' : ''}
                                        ${isRelated && !isHovered ? 'ring-1 ring-indigo-300 ring-offset-1 opacity-100' : ''}
                                    `}
                                    style={{
                                        left: taskLeft,
                                        width: taskWidth
                                    }}
                                >
                                    {/* Resize Handles (Visible on Hover or Drag) - Hide if readOnly */}
                                    {!isNew && !isEditing && !readOnly && (
                                        <>
                                            <div className={`absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-black/10 transition-colors rounded-l-full z-20 ${dragState?.taskId === task.id && dragState.mode === 'resize-left' ? 'bg-black/20' : ''}`}></div>
                                            <div className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-black/10 transition-colors rounded-r-full z-20 ${dragState?.taskId === task.id && dragState.mode === 'resize-right' ? 'bg-black/20' : ''}`}></div>
                                        </>
                                    )}

                                    {/* Dragging Tooltip */}
                                    {isDraggingThis && previewDates && (
                                        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded shadow-md text-[10px] font-bold whitespace-nowrap z-[60] flex items-center gap-1
                                            ${conflictDependencyId ? 'bg-red-600 text-white' : 'bg-[#1F1F1F] text-white'}
                                        `}>
                                            {conflictDependencyId && <span className="material-symbols-outlined text-[12px]">warning</span>}
                                            {previewDates.start.slice(5).replace('-','/')} - {previewDates.end.slice(5).replace('-','/')}
                                        </div>
                                    )}

                                    {isNew && <span className="mr-1">✨</span>}
                                    {pixelsPerDay > 3 && !isChanging && !isEditing && !isDraggingThis && (
                                        <span className="font-medium drop-shadow-sm">{task.progress}%</span>
                                    )}
                                    {isDraggingThis && (
                                         <span className="font-medium drop-shadow-sm">{task.name}</span>
                                    )}
                                </div>

                                {/* Right-side Label for Full Name Display */}
                                {!isDraggingThis && !isEditing && (
                                    <div 
                                        className={`absolute text-xs font-medium whitespace-nowrap z-10 pointer-events-none transition-all duration-200 ml-3
                                            ${isHovered ? 'text-indigo-600 font-bold z-30' : 'text-[#5F6368]'}
                                            ${isRelated && !isHovered ? 'text-indigo-400' : ''}
                                            ${shouldDim ? 'opacity-30' : 'opacity-100'}
                                        `}
                                        style={{
                                            left: taskLeft + taskWidth
                                        }}
                                    >
                                        {task.name}
                                    </div>
                                )}

                                {/* Proposed Change Bar (Ghost) */}
                                {isChanging && proposed && (
                                    <div 
                                        className="absolute h-6 md:h-8 rounded-full border-2 border-dashed border-amber-500 bg-amber-50/70 text-amber-800 text-[10px] md:text-xs flex items-center px-3 truncate animate-pulse z-0 pointer-events-none"
                                        style={{
                                            left: getX(proposed.newStartDate),
                                            width: getWidth(proposed.newStartDate, proposed.newEndDate)
                                        }}
                                    >
                                        {pixelsPerDay > 5 && "建议调整"}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Edit Modal (Portal) */}
      {editingTaskId && !readOnly && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={cancelEditing}>
              <div 
                  className="bg-white rounded-xl shadow-2xl p-6 w-[90vw] md:w-[360px] animate-in fade-in zoom-in-95 duration-200 relative" 
                  onClick={e => e.stopPropagation()}
              >
                  <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-bold text-[#1F1F1F]">编辑任务</h4>
                      <button onClick={cancelEditing} className="text-[#5F6368] hover:text-[#1F1F1F] rounded-full p-1 hover:bg-[#F1F3F4] transition-colors">
                          <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      {/* Add Task Actions (Mobile/Modal) */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                          <button 
                             onClick={() => { onInsertTask?.(editingTaskId, 'before'); cancelEditing(); }}
                             className="py-2 text-xs font-medium text-[#1F1F1F] bg-[#F1F3F4] hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                              在上方插入
                          </button>
                          <button 
                             onClick={() => { onInsertTask?.(editingTaskId, 'after'); cancelEditing(); }}
                             className="py-2 text-xs font-medium text-[#1F1F1F] bg-[#F1F3F4] hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                              在下方插入
                          </button>
                      </div>

                      {/* Task Name - High Contrast */}
                      <div className="relative group">
                          <input 
                            id="task-name"
                            value={editValues.name || ''} 
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="peer w-full h-14 rounded-lg bg-[#1F1F1F] px-4 pt-5 pb-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-transparent"
                            placeholder="Name"
                            autoFocus
                          />
                          <label htmlFor="task-name" className="absolute left-4 top-2 text-[10px] text-white/60 font-medium peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-indigo-300 transition-all pointer-events-none">任务名称</label>
                      </div>

                      {/* Assignee - High Contrast */}
                      <div className="relative group">
                          <input 
                            id="task-assignee"
                            value={editValues.assignee || ''} 
                            onChange={(e) => handleInputChange('assignee', e.target.value)}
                            className="peer w-full h-14 rounded-lg bg-[#1F1F1F] px-4 pt-5 pb-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-transparent"
                            placeholder="Assignee"
                          />
                          <label htmlFor="task-assignee" className="absolute left-4 top-2 text-[10px] text-white/60 font-medium peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-indigo-300 transition-all pointer-events-none">负责人</label>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-[10px] font-medium text-[#5F6368] mb-1 ml-1">开始日期</label>
                              <input 
                                type="date"
                                value={editValues.startDate || ''} 
                                onChange={(e) => handleInputChange('startDate', e.target.value)}
                                className="w-full h-10 rounded-lg border border-[#747775] px-2 text-sm text-[#1F1F1F] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-transparent"
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-medium text-[#5F6368] mb-1 ml-1">结束日期</label>
                              <input 
                                type="date"
                                value={editValues.endDate || ''} 
                                onChange={(e) => handleInputChange('endDate', e.target.value)}
                                className="w-full h-10 rounded-lg border border-[#747775] px-2 text-sm text-[#1F1F1F] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-transparent"
                              />
                          </div>
                      </div>

                      {/* Dependencies Selector */}
                      <div className="mt-4 border-t border-gray-100 pt-3">
                          <label className="block text-[11px] font-bold text-[#5F6368] mb-2 uppercase tracking-wide">
                              前置依赖 (Predecessors)
                          </label>
                          <div className="max-h-[120px] overflow-y-auto border border-[#E0E2E5] rounded-lg bg-[#F8F9FA] p-1 custom-scrollbar">
                              {allTasks.filter(t => t.id !== editingTaskId).map(t => (
                                  <div 
                                      key={t.id} 
                                      className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors group"
                                      onClick={() => {
                                          const current = editValues.dependencies || [];
                                          const exists = current.includes(t.id);
                                          let newDeps;
                                          if (exists) {
                                              newDeps = current.filter(id => id !== t.id);
                                          } else {
                                              newDeps = [...current, t.id];
                                          }
                                          handleInputChange('dependencies', newDeps);
                                      }}
                                  >
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                          (editValues.dependencies || []).includes(t.id) 
                                          ? 'bg-indigo-600 border-indigo-600' 
                                          : 'border-gray-400 bg-white group-hover:border-indigo-400'
                                      }`}>
                                          {(editValues.dependencies || []).includes(t.id) && (
                                              <span className="material-symbols-outlined text-[12px] text-white font-bold">check</span>
                                          )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                           <div className="text-xs text-[#1F1F1F] truncate font-medium">{t.name}</div>
                                           <div className="text-[10px] text-[#5F6368] truncate">{t.startDate} - {t.endDate}</div>
                                      </div>
                                  </div>
                              ))}
                               {allTasks.length <= 1 && <div className="text-xs text-gray-400 text-center py-2">无其他任务</div>}
                          </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end pt-2 gap-2">
                           <button 
                              onClick={cancelEditing}
                              className="px-4 py-2 text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] rounded-full transition-colors"
                          >
                              取消
                          </button>
                          <button 
                              onClick={saveEditing}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2 rounded-full transition-colors shadow-sm"
                          >
                              保存
                          </button>
                      </div>
                      
                      {/* Mobile Delete Button (Extra) */}
                      <div className="mt-2 border-t pt-2 md:hidden">
                           <button 
                              onClick={() => { cancelEditing(); setDeletingTask(allTasks.find(t => t.id === editingTaskId)!); }}
                              className="w-full py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              删除此任务
                          </button>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Delete Confirmation Modal (Portal) */}
      {deletingTask && !readOnly && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeletingTask(null)}>
              <div 
                  className="bg-white rounded-xl shadow-2xl p-6 w-[90vw] md:w-[320px] animate-in fade-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
              >
                  <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-600">
                      <span className="material-symbols-outlined">delete</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#1F1F1F] mb-2">删除任务?</h3>
                  <p className="text-sm text-[#5F6368] mb-6">
                      您确定要删除 <span className="font-bold text-[#1F1F1F]">"{deletingTask.name}"</span> 吗？此操作无法撤销。
                  </p>
                  <div className="flex justify-end gap-2">
                      <button 
                          onClick={() => setDeletingTask(null)}
                          className="px-4 py-2 text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] rounded-full transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={confirmDelete}
                          className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-sm"
                      >
                          确认删除
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default GanttChart;