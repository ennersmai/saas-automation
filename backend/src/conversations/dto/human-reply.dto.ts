import { IsNotEmpty } from 'class-validator';

export class HumanReplyDto {
  @IsNotEmpty()
  message!: string;
}
