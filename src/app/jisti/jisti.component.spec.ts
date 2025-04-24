import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JistiComponent } from './jisti.component';

describe('JistiComponent', () => {
  let component: JistiComponent;
  let fixture: ComponentFixture<JistiComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [JistiComponent]
    });
    fixture = TestBed.createComponent(JistiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
