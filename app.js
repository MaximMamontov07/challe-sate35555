class RealtimeCalendar {
    constructor() {
        this.currentDate = new Date();
        this.bookings = new Map();
        this.init();
    }

    async init() {
        // Загружаем начальные данные
        await this.loadBookings();
        
        // Подписываемся на обновления в реальном времени
        this.subscribeToChanges();
        
        // Рендерим календарь
        this.renderCalendar();
        
        // Добавляем обработчики событий
        this.addEventListeners();
        
        // Обновляем статистику
        this.updateStats();
    }

    async loadBookings() {
        try {
            console.log('Загрузка бронирований...');
            
            // Получаем все бронирования
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .order('date', { ascending: true });

            if (error) throw error;

            // Сохраняем в Map для быстрого доступа
            this.bookings.clear();
            data.forEach(booking => {
                this.bookings.set(booking.date, booking.is_booked);
            });

            console.log(`Загружено ${this.bookings.size} записей`);
            this.updateLastUpdate();
            
        } catch (error) {
            console.error('Ошибка при загрузке:', error);
            alert('Ошибка загрузки данных. Проверьте консоль.');
        }
    }

    subscribeToChanges() {
        // Подписываемся на все изменения в таблице bookings
        supabase
            .channel('bookings_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'bookings'
                },
                (payload) => {
                    console.log('Изменение получено:', payload);
                    
                    // Обновляем локальные данные
                    if (payload.eventType === 'DELETE') {
                        this.bookings.delete(payload.old.date);
                    } else {
                        this.bookings.set(payload.new.date, payload.new.is_booked);
                    }
                    
                    // Перерисовываем календарь
                    this.renderCalendar();
                    this.updateStats();
                    this.updateLastUpdate();
                    
                    // Визуальная обратная связь
                    this.showNotification('Календарь обновлен!');
                }
            )
            .subscribe();
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Обновляем заголовок
        document.getElementById('currentMonth').textContent = 
            this.currentDate.toLocaleDateString('ru-RU', { 
                month: 'long', 
                year: 'numeric',
                timeZone: 'UTC'
            }).replace(' г.', '');
        
        // Получаем первый и последний день месяца
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Получаем день недели первого дня (0 - воскресенье, 1 - понедельник и т.д.)
        let firstDayIndex = firstDay.getDay();
        if (firstDayIndex === 0) firstDayIndex = 7; // Воскресенье -> 7
        firstDayIndex--; // Делаем 0-6
        
        // Получаем последний день месяца
        const lastDate = lastDay.getDate();
        
        // Получаем последний день предыдущего месяца
        const prevLastDay = new Date(year, month, 0).getDate();
        
        const daysContainer = document.getElementById('calendarDays');
        daysContainer.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Дни предыдущего месяца
        for (let i = firstDayIndex; i > 0; i--) {
            const day = document.createElement('div');
            day.className = 'day-cell empty';
            day.textContent = prevLastDay - i + 1;
            daysContainer.appendChild(day);
        }
        
        // Дни текущего месяца
        for (let i = 1; i <= lastDate; i++) {
            const day = document.createElement('div');
            const date = new Date(year, month, i);
            date.setHours(0, 0, 0, 0);
            
            const dateString = date.toISOString().split('T')[0];
            const isBooked = this.bookings.get(dateString) || false;
            const isToday = date.getTime() === today.getTime();
            
            let className = 'day-cell';
            if (isBooked) {
                className += ' booked';
            } else {
                className += ' available';
            }
            
            if (isToday) {
                className += ' today';
            }
            
            day.className = className;
            day.textContent = i;
            day.dataset.date = dateString;
            
            // Добавляем обработчик клика
            day.addEventListener('click', () => this.toggleBooking(dateString));
            
            daysContainer.appendChild(day);
        }
        
        // Дни следующего месяца
        const totalCells = 42; // 6 недель × 7 дней
        const nextDays = totalCells - (firstDayIndex + lastDate);
        
        for (let i = 1; i <= nextDays; i++) {
            const day = document.createElement('div');
            day.className = 'day-cell empty';
            day.textContent = i;
            daysContainer.appendChild(day);
        }
    }

    async toggleBooking(dateString) {
        try {
            const isCurrentlyBooked = this.bookings.get(dateString) || false;
            const newStatus = !isCurrentlyBooked;
            
            // Обновляем в Supabase (upsert - создает или обновляет)
            const { error } = await supabase
                .from('bookings')
                .upsert({
                    date: dateString,
                    is_booked: newStatus,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'date'
                });

            if (error) throw error;
            
            // Локальное обновление происходит через Realtime подписку
            
        } catch (error) {
            console.error('Ошибка при обновлении:', error);
            alert('Ошибка обновления. Проверьте консоль.');
        }
    }

    updateStats() {
        let free = 0;
        let booked = 0;
        
        this.bookings.forEach((isBooked) => {
            if (isBooked) {
                booked++;
            } else {
                free++;
            }
        });
        
        document.getElementById('freeDays').textContent = free;
        document.getElementById('bookedDays').textContent = booked;
    }

    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            now.toLocaleTimeString('ru-RU');
    }

    showNotification(message) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Добавляем стили для анимации
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }

    addEventListeners() {
        // Кнопки навигации
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            } else if (e.key === 'ArrowRight') {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            } else if (e.key === 't' || e.key === 'T') {
                this.currentDate = new Date();
                this.renderCalendar();
            }
        });
    }
}

// Инициализируем календарь когда страница загружена
document.addEventListener('DOMContentLoaded', () => {
    window.calendar = new RealtimeCalendar();
});