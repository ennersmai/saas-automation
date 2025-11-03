import { IsBoolean, IsOptional, IsString, MaxLength, IsObject } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @MaxLength(2000)
  template_body: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  trigger_type?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
