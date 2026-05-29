(function () {
  const DAY_NAMES = [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье'
  ];

  const EMPTY_DAY_PHRASES = [
    'Чистый лист. Время для важных дел.',
    'Сегодня спокойно. Можно сфокусироваться на главном.',
    'Пока пусто. Отличный момент запланировать день.'
  ];

  const STORAGE_KEY = 'week-planner-data';
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  const weekTitleEl = document.querySelector('.week-title');
  const mainHeaderEl = document.querySelector('.main-header h2');
  const dayCards = Array.from(document.querySelectorAll('.day-card'));
  const prevWeekBtn = document.querySelector('.week-nav .icon-btn:first-child');
  const nextWeekBtn = document.querySelector('.week-nav .icon-btn:last-child');

  const taskForm = document.querySelector('.task-form');
  const taskTextInput = taskForm ? taskForm.querySelector('input[name="taskTitle"]') : null;
  const taskDateInput = taskForm ? taskForm.querySelector('input[name="taskDate"]') : null;
  const taskTimeInput = taskForm ? taskForm.querySelector('input[name="taskTime"]') : null;
  const taskPrioritySelect = taskForm ? taskForm.querySelector('select[name="taskPriority"]') : null;
  const tasksSection = document.querySelector('.tasks-section');

  if (!weekTitleEl || !mainHeaderEl || dayCards.length < 7 || !prevWeekBtn || !nextWeekBtn || !taskForm || !taskTextInput || !tasksSection) {
    return;
  }

  const todayStart = normalizeDate(new Date());
  let currentWeekStart = getWeekStartMonday(todayStart);
  let selectedDayIndex = getMondayBasedDayIndex(todayStart);
  let currentWeekDates = [];
  let overdueTaskIds = new Set();

  let tasks = loadTasksFromStorage();

  dayCards.forEach((card, index) => {
    card.dataset.dayIndex = String(index);
    card.addEventListener('click', () => {
      selectedDayIndex = index;
      renderWeek({ animateHeader: true });
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');

      const taskId = event.dataTransfer ? event.dataTransfer.getData('text/task-id') : '';
      if (!taskId) {
        return;
      }

      moveTaskToDayCard(taskId, index);
    });
  });

  prevWeekBtn.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    renderWeek({ animateHeader: true });
  });

  nextWeekBtn.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    renderWeek({ animateHeader: true });
  });

  taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createTaskFromForm();
  });

  taskTextInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      createTaskFromForm();
    }
  });

  tasksSection.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const card = button.closest('.task-card[data-task-id]');
    if (!card) {
      return;
    }

    const taskId = card.dataset.taskId;
    const action = button.dataset.action;

    if (action === 'complete') {
      updateTaskStatus(taskId, 'completed');
      return;
    }

    if (action === 'postpone') {
      updateTaskStatus(taskId, 'postponed');
      return;
    }

    if (action === 'delete') {
      deleteTask(taskId);
      return;
    }

    if (action === 'confirm-today') {
      confirmTaskForToday(taskId);
      return;
    }

    if (action === 'next-week') {
      moveTaskNextWeek(taskId);
      return;
    }

    if (action === 'edit') {
      startTaskEdit(taskId);
    }
  });

  tasksSection.addEventListener('change', (event) => {
    const dateChanger = event.target.closest('input[data-action="change-date"]');
    if (!dateChanger) {
      return;
    }

    const card = dateChanger.closest('.task-card[data-task-id]');
    if (!card) {
      return;
    }

    const nextDate = dateChanger.value;
    if (!nextDate) {
      return;
    }

    updateTaskDate(card.dataset.taskId, nextDate);
  });

  tasksSection.addEventListener('dblclick', (event) => {
    const titleEl = event.target.closest('.task-title');
    if (!titleEl) {
      return;
    }

    const card = titleEl.closest('.task-card[data-task-id]');
    if (!card) {
      return;
    }

    startTaskEdit(card.dataset.taskId);
  });

  renderWeek({ animateHeader: false });

  function createTaskFromForm() {
    const text = taskTextInput.value.trim();

    if (!text) {
      taskTextInput.value = '';
      return;
    }

    const selectedDate = getSelectedDate();
    const fallbackDate = formatDateISO(selectedDate);
    const finalDate = taskDateInput && taskDateInput.value ? taskDateInput.value : fallbackDate;
    const finalTime = taskTimeInput && taskTimeInput.value ? taskTimeInput.value : null;
    const finalPriority = taskPrioritySelect && taskPrioritySelect.value ? taskPrioritySelect.value : 'medium';

    const nowIso = new Date().toISOString();
    const newTask = {
      id: createTaskId(),
      text,
      date: finalDate,
      time: finalTime,
      priority: normalizePriority(finalPriority),
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    tasks.push(newTask);
    if (!saveTasksToStorage(tasks)) {
      return;
    }

    taskTextInput.value = '';
    if (taskDateInput) {
      taskDateInput.value = '';
    }
    if (taskTimeInput) {
      taskTimeInput.value = '';
    }
    if (taskPrioritySelect) {
      taskPrioritySelect.value = 'medium';
    }

    rerenderAll();
  }

  function renderWeek(options) {
    currentWeekDates = Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));

    currentWeekDates.forEach((date, index) => {
      const card = dayCards[index];
      const dateEl = card.querySelector('.day-date');
      const nameEl = card.querySelector('h2');

      if (nameEl) {
        nameEl.textContent = DAY_NAMES[index];
      }

      if (dateEl) {
        dateEl.textContent = formatDateWithoutYear(date);
      }

      card.classList.toggle('active', index === selectedDayIndex);
    });

    weekTitleEl.textContent = formatWeekRange(currentWeekDates[0], currentWeekDates[6]);

    const selectedDate = getSelectedDate();
    const selectedDayName = DAY_NAMES[selectedDayIndex];
    const nextHeaderText = `${selectedDayName}, ${formatDateWithoutYear(selectedDate)}`;

    if (options && options.animateHeader) {
      animateHeaderChange(nextHeaderText);
    } else {
      mainHeaderEl.textContent = nextHeaderText;
    }

    refreshOverdueTasks();
    renderTasks();
    updateLeftPanelMeta();
  }

  function renderTasks() {
    const selectedDateISO = formatDateISO(getSelectedDate());
    const todayISO = formatDateISO(todayStart);
    const isTodaySelected = selectedDateISO === todayISO;

    const baseTasks = tasks.filter((task) => task.date === selectedDateISO);
    const overdueVirtualTasks = isTodaySelected
      ? tasks.filter((task) => overdueTaskIds.has(task.id))
      : [];

    const renderMap = new Map();
    baseTasks.forEach((task) => {
      renderMap.set(task.id, { ...task, isOverdueVirtual: false });
    });
    overdueVirtualTasks.forEach((task) => {
      if (!renderMap.has(task.id)) {
        renderMap.set(task.id, { ...task, isOverdueVirtual: true });
      }
    });

    const sortedTasks = sortTasksForRender(Array.from(renderMap.values()));

    tasksSection.innerHTML = '';

    if (sortedTasks.length === 0) {
      renderEmptyState();
      return;
    }

    sortedTasks.forEach((task) => {
      const taskCard = document.createElement('article');
      const isCompleted = task.status === 'completed';
      const isPostponed = task.status === 'postponed';
      const isOverdueVirtual = Boolean(task.isOverdueVirtual);

      taskCard.className = `task-card ${priorityToClass(task.priority)}${isCompleted ? ' is-completed' : ''}${isOverdueVirtual ? ' is-overdue' : ''}`;
      taskCard.dataset.taskId = task.id;
      taskCard.draggable = true;

      taskCard.addEventListener('dragstart', (event) => {
        taskCard.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/task-id', task.id);
        }
      });

      taskCard.addEventListener('dragend', () => {
        taskCard.classList.remove('is-dragging');
        dayCards.forEach((card) => card.classList.remove('drag-over'));
      });

      const timeLabel = task.time ? task.time : 'Без времени';
      const priorityLabel = capitalize(task.priority);
      const statusBadge = isPostponed ? '<span class="task-badge">Отложено</span>' : '';
      const overdueLabel = isOverdueVirtual
        ? `<span class="task-overdue-label">Просрочено с ${formatDateWithoutYear(parseISODate(task.date))}</span>`
        : '';
      const confirmTodayButton = isOverdueVirtual
        ? '<button type="button" data-action="confirm-today">Подтвердить на сегодня</button>'
        : '';

      taskCard.innerHTML = [
        '<div class="task-content">',
        `<h3 class="task-title" title="${escapeHtml(task.text)}">${escapeHtml(task.text)}</h3>`,
        `<p>${timeLabel} • ${priorityLabel} priority ${statusBadge} ${overdueLabel}</p>`,
        `<input class="task-date-inline" type="date" data-action="change-date" value="${escapeHtml(task.date)}" />`,
        '</div>',
        '<div class="task-actions">',
        `<button type="button" data-action="complete">${isCompleted ? 'Выполнено' : 'Выполнить'}</button>`,
        `<button type="button" data-action="postpone" ${isCompleted ? 'disabled' : ''}>Отложить</button>`,
        '<button type="button" data-action="edit">Редактировать</button>',
        '<button type="button" data-action="next-week">На следующую неделю</button>',
        confirmTodayButton,
        '<button type="button" class="danger" data-action="delete">Удалить</button>',
        '</div>'
      ].join('');

      tasksSection.appendChild(taskCard);
    });
  }

  function renderEmptyState() {
    const emptyPhrase = EMPTY_DAY_PHRASES[Math.floor(Math.random() * EMPTY_DAY_PHRASES.length)];
    const emptyState = document.createElement('article');
    emptyState.className = 'task-empty-state is-visible';
    emptyState.innerHTML = `<p>${emptyPhrase}</p>`;
    tasksSection.appendChild(emptyState);
  }

  function sortTasksForRender(dayTasks) {
    return [...dayTasks].sort((a, b) => {
      const aCompleted = a.status === 'completed';
      const bCompleted = b.status === 'completed';

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      const aHasTime = typeof a.time === 'string' && a.time.length > 0;
      const bHasTime = typeof b.time === 'string' && b.time.length > 0;

      if (aHasTime !== bHasTime) {
        return aHasTime ? -1 : 1;
      }

      if (aHasTime && bHasTime) {
        const timeCompare = a.time.localeCompare(b.time);
        if (timeCompare !== 0) {
          return timeCompare;
        }
      }

      if (!aHasTime && !bHasTime) {
        const priorityCompare = PRIORITY_ORDER[normalizePriority(a.priority)] - PRIORITY_ORDER[normalizePriority(b.priority)];
        if (priorityCompare !== 0) {
          return priorityCompare;
        }
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function startTaskEdit(taskId) {
    const card = tasksSection.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (!card) {
      return;
    }

    const titleEl = card.querySelector('.task-title');
    if (!titleEl || card.querySelector('.task-edit-input')) {
      return;
    }

    const currentText = titleEl.textContent || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = currentText;

    titleEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    let saved = false;

    const saveEdit = () => {
      if (saved) {
        return;
      }

      const nextText = input.value.trim();
      if (!nextText) {
        alert('Текст задачи не может быть пустым.');
        input.focus();
        return;
      }

      saved = true;
      tasks = tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          text: nextText,
          updatedAt: new Date().toISOString()
        };
      });

      if (!saveTasksToStorage(tasks)) {
        return;
      }
      rerenderAll();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveEdit();
      }

      if (event.key === 'Escape') {
        saved = true;
        renderTasks();
      }
    });
  }

  function updateTaskStatus(taskId, status) {
    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        status,
        updatedAt: new Date().toISOString()
      };
    });

    if (!saveTasksToStorage(tasks)) {
      return;
    }
    rerenderAll();
  }

  function confirmTaskForToday(taskId) {
    updateTaskDate(taskId, formatDateISO(todayStart));
  }

  function updateTaskDate(taskId, nextDateISO) {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) {
      return;
    }

    if (targetTask.date === nextDateISO) {
      return;
    }

    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        date: nextDateISO,
        updatedAt: new Date().toISOString()
      };
    });

    if (!saveTasksToStorage(tasks)) {
      return;
    }
    rerenderAll();
  }

  function moveTaskToDayCard(taskId, dayCardIndex) {
    const targetDate = currentWeekDates[dayCardIndex];
    if (!targetDate) {
      return;
    }

    updateTaskDate(taskId, formatDateISO(targetDate));
  }

  function moveTaskNextWeek(taskId) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const nextDate = addDays(parseISODate(task.date), 7);
    updateTaskDate(taskId, formatDateISO(nextDate));
  }

  function deleteTask(taskId) {
    const isConfirmed = confirm('Удалить задачу? Это действие нельзя отменить.');
    if (!isConfirmed) {
      return;
    }

    tasks = tasks.filter((task) => task.id !== taskId);
    if (!saveTasksToStorage(tasks)) {
      return;
    }
    rerenderAll();
  }

  function updateLeftPanelMeta() {
    currentWeekDates.forEach((date, index) => {
      const dateISO = formatDateISO(date);
      const dayTasks = sortTasksForRender(tasks.filter((task) => task.date === dateISO));
      const countEl = dayCards[index].querySelector('.task-count');
      const previewEl = dayCards[index].querySelector('.task-preview');

      if (countEl) {
        countEl.textContent = formatTaskCount(dayTasks.length);
      }

      if (previewEl) {
        previewEl.innerHTML = '';

        if (dayTasks.length === 0) {
          previewEl.textContent = '• Нет задач';
        } else {
          dayTasks.slice(0, 3).forEach((task) => {
            const item = document.createElement('span');
            item.className = 'preview-item';
            item.textContent = `• ${task.text}`;
            previewEl.appendChild(item);
          });
        }
      }
    });
  }

  function rerenderAll() {
    refreshOverdueTasks();
    renderTasks();
    updateLeftPanelMeta();
  }

  function refreshOverdueTasks() {
    const todayISO = formatDateISO(todayStart);
    overdueTaskIds = new Set(
      tasks
        .filter((task) => task.status !== 'completed' && task.date < todayISO)
        .map((task) => task.id)
    );
  }

  function getSelectedDate() {
    return currentWeekDates[selectedDayIndex];
  }

  function loadTasksFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
    } catch (error) {
      return [];
    }
  }

  function saveTasksToStorage(nextTasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
      return true;
    } catch (error) {
      alert('Не удалось сохранить задачи. Возможно, переполнено хранилище браузера.');
      return false;
    }
  }

  function isValidTask(task) {
    if (!task || typeof task !== 'object') {
      return false;
    }

    const validPriorities = ['high', 'medium', 'low'];
    const validStatuses = ['active', 'completed', 'postponed'];

    return (
      typeof task.id === 'string' &&
      typeof task.text === 'string' &&
      typeof task.date === 'string' &&
      (typeof task.time === 'string' || task.time === null) &&
      validPriorities.includes(task.priority) &&
      validStatuses.includes(task.status) &&
      typeof task.createdAt === 'string' &&
      typeof task.updatedAt === 'string'
    );
  }

  function animateHeaderChange(nextText) {
    mainHeaderEl.classList.add('is-fading');

    window.setTimeout(() => {
      mainHeaderEl.textContent = nextText;
      mainHeaderEl.classList.remove('is-fading');
    }, 200);
  }

  function getWeekStartMonday(date) {
    const normalized = normalizeDate(date);
    const day = normalized.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    return addDays(normalized, diffToMonday);
  }

  function getMondayBasedDayIndex(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  function formatDateWithoutYear(date) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long'
    }).format(date);
  }

  function formatWeekRange(startDate, endDate) {
    return `${formatDateWithoutYear(startDate)} - ${formatDateWithoutYear(endDate)}`;
  }

  function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTaskCount(count) {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} задача`;
    }

    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return `${count} задачи`;
    }

    return `${count} задач`;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return normalizeDate(result);
  }

  function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function parseISODate(value) {
    const parts = value.split('-').map((item) => Number(item));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return todayStart;
    }

    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }

  function createTaskId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizePriority(priority) {
    return ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
  }

  function priorityToClass(priority) {
    const normalizedPriority = normalizePriority(priority);
    return `priority-${normalizedPriority}`;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
