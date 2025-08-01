// src/core/domain/entities/Category.ts - Entidad de dominio para Category - Lógica de negocio

import { CATEGORY_CONFIG, ERROR_CODES } from '@/utils/constants';

export interface CategoryProps {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userId: string;
}

export interface CategoryValidationError {
  field: string;
  message: string;
  code: string;
}

export class Category {
  private _id?: string;
  private _name: string;
  private _description?: string;
  private _color: string;
  private _icon: string;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _userId: string;

  constructor(props: CategoryProps) {
    // Validar propiedades requeridas
    this.validateRequiredFields(props);

    // Asignar valores con defaults
    this._id = props.id;
    this._name = this.validateAndSetName(props.name);
    this._description = this.validateAndSetDescription(props.description);
    this._color = this.validateAndSetColor(props.color);
    this._icon = this.validateAndSetIcon(props.icon);
    this._isActive = props.isActive !== undefined ? props.isActive : true;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._userId = props.userId;

    // Validaciones de negocio
    this.validateBusinessRules();
  }

  // Getters
  get id(): string | undefined {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | undefined {
    return this._description;
  }
  get color(): string {
    return this._color;
  }
  get icon(): string {
    return this._icon;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get userId(): string {
    return this._userId;
  }

  // Métodos de dominio para modificar la categoría
  public updateName(newName: string): void {
    this._name = this.validateAndSetName(newName);
    this._updatedAt = new Date();
  }

  public updateDescription(newDescription?: string): void {
    this._description = this.validateAndSetDescription(newDescription);
    this._updatedAt = new Date();
  }

  public updateColor(newColor: string): void {
    this._color = this.validateAndSetColor(newColor);
    this._updatedAt = new Date();
  }

  public updateIcon(newIcon: string): void {
    this._icon = this.validateAndSetIcon(newIcon);
    this._updatedAt = new Date();
  }

  public activate(): void {
    if (this._isActive) {
      return; // Ya está activa
    }

    this._isActive = true;
    this._updatedAt = new Date();
  }

  public deactivate(): void {
    if (!this._isActive) {
      return; // Ya está inactiva
    }

    this._isActive = false;
    this._updatedAt = new Date();
  }

  public updateDetails(
    updates: Partial<{
      name: string;
      description: string;
      color: string;
      icon: string;
    }>,
  ): void {
    let hasChanges = false;

    if (updates.name !== undefined && updates.name !== this._name) {
      this._name = this.validateAndSetName(updates.name);
      hasChanges = true;
    }

    if (
      updates.description !== undefined &&
      updates.description !== this._description
    ) {
      this._description = this.validateAndSetDescription(updates.description);
      hasChanges = true;
    }

    if (updates.color !== undefined && updates.color !== this._color) {
      this._color = this.validateAndSetColor(updates.color);
      hasChanges = true;
    }

    if (updates.icon !== undefined && updates.icon !== this._icon) {
      this._icon = this.validateAndSetIcon(updates.icon);
      hasChanges = true;
    }

    if (hasChanges) {
      this._updatedAt = new Date();
    }
  }

  // Métodos de consulta del dominio
  public isOwnedBy(userId: string): boolean {
    return this._userId === userId;
  }

  public hasDescription(): boolean {
    return !!this._description && this._description.trim().length > 0;
  }

  public isDefaultColor(): boolean {
    return this._color === CATEGORY_CONFIG.DEFAULT_COLOR;
  }

  public isDefaultIcon(): boolean {
    return this._icon === CATEGORY_CONFIG.DEFAULT_ICON;
  }

  public getDisplayName(): string {
    return this._name;
  }

  public getColorHex(): string {
    // Asegurar que el color siempre tenga el formato hex correcto
    return this._color.startsWith('#') ? this._color : `#${this._color}`;
  }

  public isValidForDeletion(): boolean {
    // Una categoría puede ser eliminada si está inactiva o no tiene restricciones específicas
    // La lógica de si tiene tareas asociadas se maneja en el servicio de aplicación
    return this._isActive; // Por ahora, solo las categorías activas pueden ser "candidatas" a eliminación
  }

  public canBeRenamed(newName: string): boolean {
    try {
      this.validateAndSetName(newName);
      return true;
    } catch {
      return false;
    }
  }

  public getDaysSinceCreation(): number {
    const now = new Date();
    const diffTime = now.getTime() - this._createdAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  public getDaysSinceLastUpdate(): number {
    const now = new Date();
    const diffTime = now.getTime() - this._updatedAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  public wasRecentlyUpdated(days: number = 7): boolean {
    return this.getDaysSinceLastUpdate() <= days;
  }

  public wasRecentlyCreated(days: number = 7): boolean {
    return this.getDaysSinceCreation() <= days;
  }

  // Métodos de validación privados
  private validateRequiredFields(props: CategoryProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    if (!props.userId || props.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
  }

  private validateAndSetName(name: string): string {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Category name cannot be empty');
    }

    if (cleanName.length > CATEGORY_CONFIG.MAX_NAME_LENGTH) {
      throw new Error(
        `Category name too long. Maximum ${CATEGORY_CONFIG.MAX_NAME_LENGTH} characters`,
      );
    }

    // Validar caracteres especiales (permitir letras, números, espacios, y algunos símbolos comunes)
    const validNamePattern =
      /^[a-zA-ZÀ-ÿ0-9\s\-_()[\]{}!@#$%^&*+=<>?|~`'".,;:]+$/;
    if (!validNamePattern.test(cleanName)) {
      throw new Error('Category name contains invalid characters');
    }

    return cleanName;
  }

  private validateAndSetDescription(description?: string): string | undefined {
    if (!description) return undefined;

    const cleanDescription = description.trim();

    if (!cleanDescription) return undefined;

    if (cleanDescription.length > CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `Category description too long. Maximum ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} characters`,
      );
    }

    return cleanDescription;
  }

  private validateAndSetColor(color?: string): string {
    if (!color) {
      return CATEGORY_CONFIG.DEFAULT_COLOR;
    }

    const cleanColor = color.trim().toLowerCase();

    // Validar formato hex color
    const hexColorPattern = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
    if (!hexColorPattern.test(cleanColor)) {
      throw new Error(
        'Color must be a valid hex color (e.g., #ff0000 or #f00)',
      );
    }

    // Asegurar que tenga el prefijo #
    return cleanColor.startsWith('#') ? cleanColor : `#${cleanColor}`;
  }

  private validateAndSetIcon(icon?: string): string {
    if (!icon) {
      return CATEGORY_CONFIG.DEFAULT_ICON;
    }

    const cleanIcon = icon.trim().toLowerCase();

    if (!cleanIcon) {
      return CATEGORY_CONFIG.DEFAULT_ICON;
    }

    // Validar que el icono tenga un formato válido (nombre de icono simple)
    const validIconPattern = /^[a-z0-9\-_]+$/;
    if (!validIconPattern.test(cleanIcon)) {
      throw new Error(
        'Icon name must contain only lowercase letters, numbers, hyphens, and underscores',
      );
    }

    if (cleanIcon.length > 50) {
      throw new Error('Icon name too long. Maximum 50 characters');
    }

    return cleanIcon;
  }

  private validateBusinessRules(): void {
    // Validar que createdAt no sea posterior a updatedAt
    if (this._createdAt > this._updatedAt) {
      this._updatedAt = this._createdAt;
    }

    // Si no hay descripción, asegurar que sea undefined en lugar de string vacío
    if (this._description === '') {
      this._description = undefined;
    }

    // Validar formato de color hex
    if (!this._color.match(/^#[0-9a-f]{3,6}$/i)) {
      this._color = CATEGORY_CONFIG.DEFAULT_COLOR;
    }
  }

  // Método para serializar a objeto plano (para persistencia)
  public toPlainObject(): CategoryProps {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      color: this._color,
      icon: this._icon,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      userId: this._userId,
    };
  }

  // Método estático para crear desde objeto plano
  public static fromPlainObject(props: CategoryProps): Category {
    return new Category(props);
  }

  // Método para clonar la categoría
  public clone(): Category {
    return Category.fromPlainObject(this.toPlainObject());
  }

  // Método para comparar igualdad
  public equals(other: Category): boolean {
    return this._id === other._id;
  }

  // Método para comparar igualdad por nombre y usuario (para duplicados)
  public hasSameNameAndUser(other: Category): boolean {
    return (
      this._name.toLowerCase() === other._name.toLowerCase() &&
      this._userId === other._userId
    );
  }

  // Método estático para validar unicidad de nombre por usuario
  public static validateUniqueNameForUser(
    newCategory: Category,
    existingCategories: Category[],
  ): boolean {
    return !existingCategories.some(
      (existing) =>
        existing._id !== newCategory._id &&
        existing.hasSameNameAndUser(newCategory),
    );
  }

  // Método para obtener información de resumen para logs/audit
  public getSummaryInfo(): {
    id?: string;
    name: string;
    userId: string;
    isActive: boolean;
    color: string;
    icon: string;
  } {
    return {
      id: this._id,
      name: this._name,
      userId: this._userId,
      isActive: this._isActive,
      color: this._color,
      icon: this._icon,
    };
  }

  // Método toString para debugging
  public toString(): string {
    const status = this._isActive ? 'active' : 'inactive';
    return `Category(${this._id}): "${this._name}" [${status}] {${this._color}, ${this._icon}}`;
  }

  // Métodos estáticos de utilidad
  public static createDefault(userId: string, name: string): Category {
    return new Category({
      name,
      userId,
      color: CATEGORY_CONFIG.DEFAULT_COLOR,
      icon: CATEGORY_CONFIG.DEFAULT_ICON,
      isActive: true,
    });
  }

  public static validateCategoryLimit(
    userCategories: Category[],
    maxLimit: number = CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER,
  ): boolean {
    const activeCategories = userCategories.filter((cat) => cat.isActive);
    return activeCategories.length < maxLimit;
  }

  // Método estático para obtener colores predefinidos
  public static getPresetColors(): string[] {
    return [
      '#6366f1', // Indigo (default)
      '#ef4444', // Red
      '#f59e0b', // Amber
      '#10b981', // Emerald
      '#3b82f6', // Blue
      '#8b5cf6', // Violet
      '#f97316', // Orange
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#ec4899', // Pink
      '#6b7280', // Gray
      '#14b8a6', // Teal
    ];
  }

  // Método estático para obtener iconos predefinidos
  public static getPresetIcons(): string[] {
    return [
      'folder', // default
      'work', // trabajo
      'home', // hogar
      'health', // salud
      'education', // educación
      'finance', // finanzas
      'shopping', // compras
      'travel', // viajes
      'entertainment', // entretenimiento
      'social', // social
      'hobby', // pasatiempos
      'urgent', // urgente
      'project', // proyecto
      'meeting', // reunión
      'goal', // meta
      'routine', // rutina
    ];
  }

  // Método estático para crear categorías predeterminadas para un nuevo usuario
  public static createDefaultCategoriesForUser(userId: string): Category[] {
    const defaultCategories = [
      { name: 'Personal', color: '#6366f1', icon: 'home' },
      { name: 'Work', color: '#3b82f6', icon: 'work' },
      { name: 'Health', color: '#10b981', icon: 'health' },
      { name: 'Learning', color: '#f59e0b', icon: 'education' },
    ];

    return defaultCategories.map(
      (cat) =>
        new Category({
          name: cat.name,
          userId,
          color: cat.color,
          icon: cat.icon,
          isActive: true,
        }),
    );
  }
}
