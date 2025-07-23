// src/core/domain/entities/Task.ts - Entidad de dominio para Task - Lógica de negocio pura
// Esta entidad representa una tarea en el sistema, incluyendo sus propiedades, estados y comportamientos.

import { 
  TASK_STATUSES, 
  TASK_PRIORITIES, 
  TASK_CONFIG,
  ERROR_CODES,
  PRIORITY_WEIGHTS 
} from '@/utils/constants';

export type TaskStatus = keyof typeof TASK_STATUSES;
export type TaskPriority = keyof typeof TASK_PRIORITIES;

export interface TaskProps {
  id?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  userId: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  attachments?: string[];
}

export interface TaskValidationError {
  field: string;
  message: string;
  code: string;
}

export class Task {
  private _id?: string;
  private _title: string;
  private _description?: string;
  private _status: TaskStatus;
  private _priority: TaskPriority;
  private _dueDate?: Date;
  private _completedAt?: Date;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _userId: string;
  private _categoryId?: string;
  private _tags: string[];
  private _estimatedHours?: number;
  private _actualHours?: number;
  private _attachments: string[];

  constructor(props: TaskProps) {
    // Validar propiedades requeridas
    this.validateRequiredFields(props);
    
    // Asignar valores con defaults
    this._id = props.id;
    this._title = this.validateAndSetTitle(props.title);
    this._description = this.validateAndSetDescription(props.description);
    this._status = props.status || 'PENDING';
    this._priority = props.priority || 'MEDIUM';
    this._dueDate = this.validateAndSetDueDate(props.dueDate);
    this._completedAt = props.completedAt;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._userId = props.userId;
    this._categoryId = props.categoryId;
    this._tags = this.validateAndSetTags(props.tags || []);
    this._estimatedHours = this.validateAndSetEstimatedHours(props.estimatedHours);
    this._actualHours = this.validateAndSetActualHours(props.actualHours);
    this._attachments = props.attachments || [];

    // Validaciones de negocio
    this.validateBusinessRules();
  }

  // Getters
  get id(): string | undefined { return this._id; }
  get title(): string { return this._title; }
  get description(): string | undefined { return this._description; }
  get status(): TaskStatus { return this._status; }
  get priority(): TaskPriority { return this._priority; }
  get dueDate(): Date | undefined { return this._dueDate; }
  get completedAt(): Date | undefined { return this._completedAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get userId(): string { return this._userId; }
  get categoryId(): string | undefined { return this._categoryId; }
  get tags(): string[] { return [...this._tags]; }
  get estimatedHours(): number | undefined { return this._estimatedHours; }
  get actualHours(): number | undefined { return this._actualHours; }
  get attachments(): string[] { return [...this._attachments]; }

  // Métodos de dominio para cambiar estado
  public markAsInProgress(): void {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot change status of completed task to in progress');
    }
    if (this._status === 'CANCELLED') {
      throw new Error('Cannot change status of cancelled task to in progress');
    }
    
    this._status = 'IN_PROGRESS';
    this._updatedAt = new Date();
  }

  public markAsCompleted(): void {
    if (this._status === 'CANCELLED') {
      throw new Error('Cannot complete a cancelled task');
    }
    
    this._status = 'COMPLETED';
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  public markAsCancelled(): void {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed task');
    }
    
    this._status = 'CANCELLED';
    this._updatedAt = new Date();
  }

  public markAsOnHold(): void {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot put completed task on hold');
    }
    if (this._status === 'CANCELLED') {
      throw new Error('Cannot put cancelled task on hold');
    }
    
    this._status = 'ON_HOLD';
    this._updatedAt = new Date();
  }

  public markAsPending(): void {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot change completed task back to pending');
    }
    
    this._status = 'PENDING';
    this._completedAt = undefined;
    this._updatedAt = new Date();
  }

  // Métodos para actualizar propiedades
  public updateTitle(newTitle: string): void {
    this._title = this.validateAndSetTitle(newTitle);
    this._updatedAt = new Date();
  }

  public updateDescription(newDescription?: string): void {
    this._description = this.validateAndSetDescription(newDescription);
    this._updatedAt = new Date();
  }

  public updatePriority(newPriority: TaskPriority): void {
    if (!Object.keys(TASK_PRIORITIES).includes(newPriority)) {
      throw new Error(`Invalid priority: ${newPriority}`);
    }
    this._priority = newPriority;
    this._updatedAt = new Date();
  }

  public updateDueDate(newDueDate?: Date): void {
    this._dueDate = this.validateAndSetDueDate(newDueDate);
    this._updatedAt = new Date();
  }

  public updateCategory(categoryId?: string): void {
    this._categoryId = categoryId;
    this._updatedAt = new Date();
  }

  public addTag(tag: string): void {
    const cleanTag = tag.trim().toLowerCase();
    
    if (!cleanTag) {
      throw new Error('Tag cannot be empty');
    }
    
    if (cleanTag.length > TASK_CONFIG.MAX_TAG_LENGTH) {
      throw new Error(`Tag too long. Maximum ${TASK_CONFIG.MAX_TAG_LENGTH} characters`);
    }
    
    if (this._tags.length >= TASK_CONFIG.MAX_TAGS_COUNT) {
      throw new Error(`Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`);
    }
    
    if (!this._tags.includes(cleanTag)) {
      this._tags.push(cleanTag);
      this._updatedAt = new Date();
    }
  }

  public removeTag(tag: string): void {
    const cleanTag = tag.trim().toLowerCase();
    const index = this._tags.indexOf(cleanTag);
    
    if (index > -1) {
      this._tags.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  public updateTags(tags: string[]): void {
    this._tags = this.validateAndSetTags(tags);
    this._updatedAt = new Date();
  }

  public updateEstimatedHours(hours?: number): void {
    this._estimatedHours = this.validateAndSetEstimatedHours(hours);
    this._updatedAt = new Date();
  }

  public updateActualHours(hours?: number): void {
    this._actualHours = this.validateAndSetActualHours(hours);
    this._updatedAt = new Date();
  }

  public addAttachment(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new Error('Attachment URL is required');
    }
    
    if (this._attachments.length >= TASK_CONFIG.MAX_ATTACHMENTS_COUNT) {
      throw new Error(`Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`);
    }
    
    if (!this._attachments.includes(url)) {
      this._attachments.push(url);
      this._updatedAt = new Date();
    }
  }

  public removeAttachment(url: string): void {
    const index = this._attachments.indexOf(url);
    if (index > -1) {
      this._attachments.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  // Métodos de consulta del dominio
  public isOverdue(): boolean {
    return this._dueDate ? 
      (this._dueDate < new Date() && !this.isCompleted()) : 
      false;
  }

  public isCompleted(): boolean {
    return this._status === 'COMPLETED';
  }

  public isCancelled(): boolean {
    return this._status === 'CANCELLED';
  }

  public isActive(): boolean {
    return !this.isCompleted() && !this.isCancelled();
  }

  public getDaysUntilDue(): number | null {
    if (!this._dueDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(this._dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public getPriorityWeight(): number {
    return PRIORITY_WEIGHTS[this._priority] || 1;
  }

  public getProgressPercentage(): number {
    if (this.isCompleted()) return 100;
    if (this._status === 'CANCELLED') return 0;
    if (this._status === 'IN_PROGRESS') return 50;
    if (this._status === 'ON_HOLD') return 25;
    return 0; // PENDING
  }

  public hasCategory(): boolean {
    return !!this._categoryId;
  }

  public hasDueDate(): boolean {
    return !!this._dueDate;
  }

  public hasTag(tag: string): boolean {
    return this._tags.includes(tag.trim().toLowerCase());
  }

  public getTimeSpent(): number | undefined {
    return this._actualHours;
  }

  public getTimeEstimated(): number | undefined {
    return this._estimatedHours;
  }

  public isTimeTracked(): boolean {
    return this._estimatedHours !== undefined || this._actualHours !== undefined;
  }

  // Métodos de validación privados
  private validateRequiredFields(props: TaskProps): void {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Task title is required');
    }
    
    if (!props.userId || props.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
  }

  private validateAndSetTitle(title: string): string {
    const cleanTitle = title.trim();
    
    if (!cleanTitle) {
      throw new Error('Task title cannot be empty');
    }
    
    if (cleanTitle.length > TASK_CONFIG.MAX_TITLE_LENGTH) {
      throw new Error(`Title too long. Maximum ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`);
    }
    
    return cleanTitle;
  }

  private validateAndSetDescription(description?: string): string | undefined {
    if (!description) return undefined;
    
    const cleanDescription = description.trim();
    
    if (cleanDescription.length > TASK_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description too long. Maximum ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`);
    }
    
    return cleanDescription || undefined;
  }

  private validateAndSetDueDate(dueDate?: Date): Date | undefined {
    if (!dueDate) return undefined;
    
    const now = new Date();
    const minDate = new Date(now.getTime() + (TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60 * 1000));
    
    if (dueDate < minDate) {
      throw new Error(`Due date must be at least ${TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES} minutes in the future`);
    }
    
    return dueDate;
  }

  private validateAndSetTags(tags: string[]): string[] {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }
    
    if (tags.length > TASK_CONFIG.MAX_TAGS_COUNT) {
      throw new Error(`Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`);
    }
    
    const cleanTags = tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter(tag => {
        if (tag.length > TASK_CONFIG.MAX_TAG_LENGTH) {
          throw new Error(`Tag too long. Maximum ${TASK_CONFIG.MAX_TAG_LENGTH} characters`);
        }
        return true;
      });
    
    // Remover duplicados
    return [...new Set(cleanTags)];
  }

  private validateAndSetEstimatedHours(hours?: number): number | undefined {
    if (hours === undefined || hours === null) return undefined;
    
    if (typeof hours !== 'number' || hours < 0) {
      throw new Error('Estimated hours must be a positive number');
    }
    
    if (hours > TASK_CONFIG.MAX_ESTIMATED_HOURS) {
      throw new Error(`Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`);
    }
    
    return Math.round(hours * 100) / 100; // Redondear a 2 decimales
  }

  private validateAndSetActualHours(hours?: number): number | undefined {
    if (hours === undefined || hours === null) return undefined;
    
    if (typeof hours !== 'number' || hours < 0) {
      throw new Error('Actual hours must be a positive number');
    }
    
    if (hours > TASK_CONFIG.MAX_ESTIMATED_HOURS) {
      throw new Error(`Actual hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`);
    }
    
    return Math.round(hours * 100) / 100; // Redondear a 2 decimales
  }

  private validateBusinessRules(): void {
    // Si la tarea está completada, debe tener fecha de completado
    if (this._status === 'COMPLETED' && !this._completedAt) {
      this._completedAt = new Date();
    }
    
    // Si la tarea no está completada, no debe tener fecha de completado
    if (this._status !== 'COMPLETED' && this._completedAt) {
      this._completedAt = undefined;
    }
    
    // Validar que createdAt no sea posterior a updatedAt
    if (this._createdAt > this._updatedAt) {
      this._updatedAt = this._createdAt;
    }
  }

  // Método para serializar a objeto plano (para persistencia)
  public toPlainObject(): TaskProps {
    return {
      id: this._id,
      title: this._title,
      description: this._description,
      status: this._status,
      priority: this._priority,
      dueDate: this._dueDate,
      completedAt: this._completedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      userId: this._userId,
      categoryId: this._categoryId,
      tags: [...this._tags],
      estimatedHours: this._estimatedHours,
      actualHours: this._actualHours,
      attachments: [...this._attachments],
    };
  }

  // Método estático para crear desde objeto plano
  public static fromPlainObject(props: TaskProps): Task {
    return new Task(props);
  }

  // Método para clonar la tarea
  public clone(): Task {
    return Task.fromPlainObject(this.toPlainObject());
  }

  // Método para comparar igualdad
  public equals(other: Task): boolean {
    return this._id === other._id;
  }

  // Método toString para debugging
  public toString(): string {
    return `Task(${this._id}): "${this._title}" [${this._status}] [${this._priority}]`;
  }
}